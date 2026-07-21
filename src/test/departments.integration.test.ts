import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { FIXTURE_EMAILS, fixturePassword, supabaseConfig } from './fixtures'

/**
 * departments RLS — run against the LIVE linked project.
 *
 *   npm run test:departments
 *
 * The picker shows "New department" to everyone, deliberately: the guard that
 * matters is the policy, and hiding the option by role in the UI would mean the
 * same rule written twice, in two places that can drift. This file is what
 * makes that safe to say — it proves the policy is the real boundary.
 */

const { url, key } = supabaseConfig()

async function signIn(email: string): Promise<SupabaseClient<Database>> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await client.auth.signInWithPassword({ email, password: fixturePassword() })
  if (error) throw new Error(`${email}: ${error.message}`)
  return client
}

let manager: SupabaseClient<Database>
let employee: SupabaseClient<Database>

const PROBE = `Probe Dept ${Date.now()}`
const created: string[] = []

beforeAll(async () => {
  ;[manager, employee] = await Promise.all([
    signIn(FIXTURE_EMAILS.manager),
    signIn(FIXTURE_EMAILS.outsider),
  ])
}, 60_000)

afterAll(async () => {
  if (created.length === 0) return
  // No delete policy by design, so these cannot be cleaned up through the API.
  console.warn(
    `NOTE: remove the probe rows with:\n` +
      `  delete from public.departments where name in (${created.map((n) => `'${n}'`).join(', ')});`,
  )
}, 30_000)

describe('reading the list', () => {
  test('a plain employee can read the departments', async () => {
    // The picker is on the employee edit form too, so this must be readable by
    // everyone signed in, not just by managers.
    const { data, error } = await employee.from('departments').select('id, name')
    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  test('the two seeded departments are present', async () => {
    const { data } = await employee.from('departments').select('name')
    const names = (data ?? []).map((row) => row.name.toLowerCase())
    expect(names).toContain('marketing')
    expect(names).toContain('tech')
  })
})

describe('adding one', () => {
  test('a plain employee CANNOT add a department', async () => {
    const { error } = await employee
      .from('departments')
      .insert({ name: `Employee Attempt ${Date.now()}` })
      .select()

    expect(error, 'a plain employee must be refused').not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  test('a manager CAN add a department', async () => {
    const { data, error } = await manager
      .from('departments')
      .insert({ name: PROBE })
      .select('id, name')
      .single()

    expect(error).toBeNull()
    expect(data?.name).toBe(PROBE)
    if (data) created.push(PROBE)
  })

  test('the same name in different casing is refused as a duplicate', async () => {
    // The whole reason the column is citext. Two rows that look identical in a
    // dropdown is the mess this table exists to prevent.
    const { error } = await manager
      .from('departments')
      .insert({ name: PROBE.toUpperCase() })
      .select()

    expect(error, 'a case-variant must collide').not.toBeNull()
    expect(error?.code).toBe('23505')
  })

  test('a blank name is refused', async () => {
    const { error } = await manager.from('departments').insert({ name: '   ' }).select()
    expect(error).not.toBeNull()
  })
})

describe('what cannot be done at all', () => {
  test('nobody can rename a department', async () => {
    // No update policy: renaming would leave every profile holding the old
    // string pointing at nothing. RLS reports this as zero rows matched
    // rather than as an error.
    const { data } = await manager
      .from('departments')
      .update({ name: 'Renamed By Test' })
      .eq('name', PROBE)
      .select()

    expect(data ?? []).toEqual([])
  })

  test('nobody can delete a department', async () => {
    const { data } = await manager.from('departments').delete().eq('name', PROBE).select()
    expect(data ?? []).toEqual([])

    // And it is still there.
    const { data: still } = await manager.from('departments').select('name').eq('name', PROBE)
    expect((still ?? []).length).toBe(1)
  })
})
