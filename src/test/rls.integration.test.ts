import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword } from './fixtures'

/**
 * RLS integration tests — run against the LIVE linked Supabase project.
 *
 * Excluded from `npm test` because they create real auth users and real rows.
 * Run explicitly:
 *
 *   npm run test:rls
 *
 * These verify the boundary the whole application leans on. Route guards are
 * cosmetic; if these pass, an employee genuinely cannot read a colleague's
 * data even with a hand-crafted request and the browser key.
 *
 * The two accounts created here are inert and safe to delete afterwards from
 * Authentication -> Users in the dashboard.
 */

const url = process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Distinct client per user: RLS is evaluated from the session's JWT. */
function freshClient(): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface TestUser {
  client: SupabaseClient<Database>
  id: string
  email: string
}

/**
 * Signs into a pre-provisioned fixture rather than registering at run time.
 *
 * Signup is restricted to company email domains in production, so a suite that
 * registered its own throwaway accounts would either break or force
 * `example.com` onto the allowlist permanently — which would reopen the exact
 * hole that restriction closes. Fixtures are provisioned once by an operator
 * via `public.provision_account`, which bypasses the allowlist deliberately.
 */
async function signInFixture(email: string): Promise<TestUser> {
  const client = freshClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: fixturePassword(),
  })

  if (error) throw new Error(`${email}: ${error.message}. See README "Running the live suites".`)
  return { client, id: data.user.id, email }
}

/** Two employees with no relationship to each other in either direction. */
let alice: TestUser
let bob: TestUser

/** Rows accumulate on permanent fixtures; a fresh window per run avoids clashes. */
const RUN_SEED = Date.now() % 4000

function seededDate(offset: number): string {
  const base = new Date(Date.UTC(2032, 0, 1))
  base.setUTCDate(base.getUTCDate() + RUN_SEED + offset)
  return base.toISOString().slice(0, 10)
}

beforeAll(async () => {
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')
  alice = await signInFixture('rls-fixture-a@example.com')
  bob = await signInFixture('rls-fixture-b@example.com')
}, 45_000)

describe('profiles', () => {
  test('the directory is readable — assignee pickers and org charts need it', async () => {
    const { data, error } = await alice.client.from('profiles').select('id, name').limit(5)
    expect(error).toBeNull()
    expect(data?.length).toBeGreaterThan(0)
  })

  test('an employee cannot promote themselves to super_admin', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', alice.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/super admin may change a role/i)
  })

  test('an employee cannot reassign their own reporting line', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ manager_id: bob.id })
      .eq('id', alice.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/reporting line/i)
  })

  test('an employee cannot edit a colleague’s profile', async () => {
    const { data } = await alice.client
      .from('profiles')
      .update({ name: 'Hacked By Alice' })
      .eq('id', bob.id)
      .select()

    // RLS filters the row out rather than erroring: nothing was updated.
    expect(data ?? []).toHaveLength(0)
  })

  test('an employee can edit their own name', async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ name: 'Alice Updated' })
      .eq('id', alice.id)

    expect(error).toBeNull()
  })
})

describe('work_logs — employee isolation', () => {
  let aliceLogId: string

  test('an employee can create their own work log', async () => {
    const { data, error } = await alice.client
      .from('work_logs')
      .insert({
        employee_id: alice.id,
        project: 'RLS Verification',
        task: 'Prove isolation holds',
        hours: 1,
      })
      .select()
      .single()

    expect(error).toBeNull()
    expect(data).not.toBeNull()
    aliceLogId = data!.id
  })

  test('an unrelated employee cannot read it', async () => {
    const { data, error } = await bob.client.from('work_logs').select('*').eq('id', aliceLogId)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('an employee cannot forge a work log under someone else’s id', async () => {
    const { error } = await bob.client.from('work_logs').insert({
      employee_id: alice.id,
      project: 'Forged',
      task: 'Should never insert',
      hours: 8,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
  })

  test('an unrelated employee cannot delete it', async () => {
    const { data } = await bob.client.from('work_logs').delete().eq('id', aliceLogId).select()
    expect(data ?? []).toHaveLength(0)
  })
})

describe('attendance', () => {
  test('punch_in writes a row owned by the caller', async () => {
    const { data, error } = await alice.client.rpc('punch_in', {
      p_device: 'vitest',
      p_browser: 'node',
    })

    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })

  test('an unrelated employee cannot see that attendance row', async () => {
    const { data, error } = await bob.client
      .from('attendance')
      .select('*')
      .eq('employee_id', alice.id)

    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('a second punch_in is idempotent rather than a duplicate day', async () => {
    const { data, error } = await alice.client.rpc('punch_in', {})
    expect(error).toBeNull()
    expect(data).not.toBeNull()
  })
})

describe('leaves', () => {
  let leaveId: string

  test('an employee can request leave', async () => {
    const { data, error } = await alice.client
      .from('leaves')
      .insert({
        employee_id: alice.id,
        leave_type: 'casual',
        reason: 'RLS verification',
        start_date: seededDate(0),
        end_date: seededDate(1),
      })
      .select()
      .single()

    expect(error).toBeNull()
    leaveId = data!.id
  })

  test('an employee cannot approve their own leave', async () => {
    const { error } = await alice.client
      .from('leaves')
      .update({ status: 'approved' })
      .eq('id', leaveId)

    expect(error).not.toBeNull()
  })

  test('overlapping leave is rejected', async () => {
    // Starts on the day the request above ends — inclusive on both ends, so
    // this is the same day off requested twice.
    const { error } = await alice.client.from('leaves').insert({
      employee_id: alice.id,
      leave_type: 'sick',
      reason: 'Overlaps the request above',
      start_date: seededDate(1),
      end_date: seededDate(2),
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/overlaps/i)
  })

  test('an unrelated employee cannot see the request', async () => {
    const { data } = await bob.client.from('leaves').select('*').eq('id', leaveId)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('audit_logs — super admin only', () => {
  test('an employee reads nothing, even though rows exist', async () => {
    const { data, error } = await alice.client.from('audit_logs').select('*').limit(10)
    expect(error).toBeNull()
    expect(data ?? []).toHaveLength(0)
  })

  test('an employee cannot delete audit rows', async () => {
    const { data } = await alice.client
      .from('audit_logs')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000')
      .select()

    expect(data ?? []).toHaveLength(0)
  })
})

describe('notifications', () => {
  test('an employee cannot read another employee’s notifications', async () => {
    const { data } = await bob.client.from('notifications').select('*').eq('user_id', alice.id)
    expect(data ?? []).toHaveLength(0)
  })

  test('an employee cannot inject a notification for someone else', async () => {
    const { error } = await bob.client.from('notifications').insert({
      user_id: alice.id,
      title: 'Injected',
      type: 'announcement',
    })

    expect(error).not.toBeNull()
  })
})
