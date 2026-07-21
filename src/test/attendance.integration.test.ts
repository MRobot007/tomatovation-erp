import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword } from './fixtures'

/**
 * Punch RPC behaviour — run against the LIVE linked project.
 *
 *   npm run test:attendance
 *
 * The hour, late and overtime *arithmetic* is tested in
 * supabase/tests/attendance_calculations.sql, not here. Migration 0015 locked
 * attendance timestamps so only the punch RPCs can write them — an employee
 * being able to backdate their own punch_in was a payroll-integrity hole — so
 * a test can no longer insert a synthetic workday over the API. A trigger is a
 * database unit and belongs in a database test.
 *
 * What remains here is the part that only exists at the API boundary: that the
 * RPCs are idempotent, enforce their state machine, and that the lock itself
 * holds against a plain authenticated caller.
 *
 * The npm script clears today's row first, since these assertions need a day
 * that has not already been closed by a previous run.
 */

const url = process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.VITE_SUPABASE_ANON_KEY ?? ''

let client: SupabaseClient<Database>
let userId: string

beforeAll(async () => {
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')

  // Signs into a provisioned fixture rather than registering: signup is
  // restricted to company domains, and allowing example.com through would
  // reopen the hole that restriction exists to close.
  client = createClient<Database>(url, key, { auth: { persistSession: false } })
  const { data, error } = await client.auth.signInWithPassword({
    email: 'rls-fixture-b@example.com',
    password: fixturePassword(),
  })

  if (error) throw new Error(`${error.message}. See README "Running the live suites".`)
  userId = data.user.id
}, 45_000)

describe('configuration', () => {
  test('the settings the calculations depend on are readable', async () => {
    const { data, error } = await client.from('app_settings').select('*').single()

    expect(error).toBeNull()
    expect(data!.standard_hours).toBeGreaterThan(0)
    expect(data!.late_grace_minutes).toBeGreaterThanOrEqual(0)
    expect(data!.timezone).toBeTruthy()
  })
})

describe('the timestamp lock', () => {
  test('a plain employee CANNOT insert attendance directly', async () => {
    // Without this lock, anyone could fabricate an entire past workday.
    const { error } = await client.from('attendance').insert({
      employee_id: userId,
      date: '2041-03-01',
      punch_in: '2041-03-01T09:00:00+05:30',
    })

    expect(error).not.toBeNull()
  })

  test('a plain employee CANNOT backdate an existing punch_in', async () => {
    // The whole point: calculate_attendance_metrics recomputes from whatever
    // timestamps it is handed, so an editable punch_in means erasable lateness.
    const { data: today } = await client.rpc('punch_in', {})
    const row = today as unknown as { id: string }

    const { error } = await client
      .from('attendance')
      .update({ punch_in: '2020-01-01T05:00:00+05:30' })
      .eq('id', row.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/punching in or out/i)
  })

  test('a plain employee CANNOT edit break_minutes directly', async () => {
    const { data: today } = await client
      .from('attendance')
      .select('id')
      .eq('employee_id', userId)
      .order('date', { ascending: false })
      .limit(1)
      .single()

    // Must differ from the stored value: the guard compares OLD to NEW, so
    // writing back the same number is legitimately not a change.
    const { error } = await client
      .from('attendance')
      .update({ break_minutes: 480 })
      .eq('id', today!.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/punching in or out/i)
  })

  test('a plain employee CANNOT delete an attendance record', async () => {
    // No delete policy for employees, deliberately: erasing a late arrival
    // must not be self-service. Only a super admin can remove a record.
    const { data: rows } = await client
      .from('attendance')
      .select('id')
      .eq('employee_id', userId)
      .limit(1)

    if (!rows?.length) return

    const { data } = await client.from('attendance').delete().eq('id', rows[0]!.id).select()
    expect(data ?? []).toHaveLength(0)
  })
})

describe('punch RPCs', () => {
  test('punch_in creates today’s row', async () => {
    const { data, error } = await client.rpc('punch_in', {
      p_device: 'vitest',
      p_browser: 'node',
    })

    expect(error).toBeNull()
    const row = data as unknown as { punch_in: string; status: string }
    expect(row.punch_in).not.toBeNull()
  })

  test('punch_in is idempotent — a double tap does not move the recorded time', async () => {
    const first = await client.rpc('punch_in', {})
    const second = await client.rpc('punch_in', {})

    expect(first.error).toBeNull()
    expect(second.error).toBeNull()

    const a = first.data as unknown as { id: string; punch_in: string }
    const b = second.data as unknown as { id: string; punch_in: string }

    expect(b.id).toBe(a.id)
    expect(b.punch_in).toBe(a.punch_in)
  })

  test('toggle_break moves to on_break and back to working', async () => {
    const start = await client.rpc('toggle_break')
    expect(start.error).toBeNull()
    expect((start.data as unknown as { status: string }).status).toBe('on_break')

    const end = await client.rpc('toggle_break')
    expect(end.error).toBeNull()
    expect((end.data as unknown as { status: string }).status).toBe('working')
  })

  test('punch_out completes the day and computes hours server-side', async () => {
    const { data, error } = await client.rpc('punch_out', {})
    expect(error).toBeNull()

    const row = data as unknown as { status: string; working_hours: number; punch_out: string }
    expect(row.status).toBe('completed')
    expect(row.punch_out).not.toBeNull()
    expect(Number(row.working_hours)).toBeGreaterThanOrEqual(0)
  })

  test('punching out twice is rejected rather than silently overwriting', async () => {
    const { error } = await client.rpc('punch_out', {})
    expect(error).not.toBeNull()

    // The wording changed with migration 0029 and the change is the point: a
    // day can now be reopened, so "already punched out" is no longer a
    // terminal state to complain about. What is actually wrong is that no
    // session is open, and that is what the message says.
    expect(error?.message).toMatch(/not currently punched in/i)
  })

  test('but punching in again after punching out IS allowed', async () => {
    // The whole reason for the change above. Asserted here as well as in the
    // sessions suite, because this file is where the punch state machine is
    // documented and "punch out is final" was previously part of it.
    const back = await client.rpc('punch_in', {})
    expect(back.error).toBeNull()
    expect((back.data as unknown as { status: string }).status).toBe('working')

    await client.rpc('punch_out', {})
  })

  test('a break cannot be started after the day is closed', async () => {
    const { error } = await client.rpc('toggle_break')
    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/already closed/i)
  })
})
