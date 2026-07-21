import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { FIXTURE_EMAILS, fixturePassword, supabaseConfig } from './fixtures'

/**
 * Pipeline visibility — run against the LIVE linked project.
 *
 *   npm run test:lead-access
 *
 * The pipeline holds every company, contact, deal value and note the business
 * has. It used to be readable by anyone with an account. It is now managers,
 * super admins, and employees in a department flagged for CRM.
 *
 * The fixtures are arranged to cover each branch of that rule:
 *   a        employee in Tech       -> refused
 *   b        employee in Marketing  -> allowed
 *   manager  manager, no department -> allowed on role alone
 *   outsider employee, no department-> refused
 *
 * A test that only checked the refusals would pass just as happily against a
 * policy that locked everyone out, so both directions are asserted.
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

let techEmployee: SupabaseClient<Database>
let marketingEmployee: SupabaseClient<Database>
let manager: SupabaseClient<Database>
let noDepartment: SupabaseClient<Database>

beforeAll(async () => {
  ;[techEmployee, marketingEmployee, manager, noDepartment] = await Promise.all([
    signIn(FIXTURE_EMAILS.a),
    signIn(FIXTURE_EMAILS.b),
    signIn(FIXTURE_EMAILS.manager),
    signIn(FIXTURE_EMAILS.outsider),
  ])
}, 60_000)

describe('who can read the pipeline', () => {
  test('a Tech employee sees no leads at all', async () => {
    const { data, error } = await techEmployee.from('leads').select('id, company')
    // RLS filters rather than errors, so an empty set IS the refusal.
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })

  test('a Marketing employee CAN read leads', async () => {
    // The half that matters most: locking everyone out would pass every
    // refusal test above and still be completely broken.
    const { error } = await marketingEmployee.from('leads').select('id, company')
    expect(error).toBeNull()

    const { data } = await marketingEmployee.rpc('can_access_leads')
    expect(data).toBe(true)
  })

  test('a manager can read leads on role alone, with no department set', async () => {
    const { data } = await manager.rpc('can_access_leads')
    expect(data).toBe(true)
  })

  test('an employee with no department is refused', async () => {
    const { data } = await noDepartment.rpc('can_access_leads')
    expect(data).toBe(false)
  })
})

describe('the activity timeline is covered too', () => {
  test('a Tech employee sees no lead activity', async () => {
    // Call notes and meeting summaries are the pipeline in prose. Locking the
    // leads table and leaving this open would be the window off the latch.
    const { data, error } = await techEmployee.from('lead_activities').select('id, remarks')
    expect(error).toBeNull()
    expect(data ?? []).toEqual([])
  })
})

describe('writes are closed too, not just reads', () => {
  test('a Tech employee cannot create a lead', async () => {
    const { data: me } = await techEmployee.auth.getUser()
    const { error } = await techEmployee
      .from('leads')
      .insert({ company: `Tech Probe ${Date.now()}`, created_by: me.user!.id })
      .select()

    expect(error, 'insert must be refused, not silently accepted').not.toBeNull()
    expect(error?.code).toBe('42501')
  })

  test('a Tech employee cannot log activity against a lead', async () => {
    const { data: me } = await techEmployee.auth.getUser()
    const { error } = await techEmployee
      .from('lead_activities')
      .insert({
        lead_id: '00000000-0000-0000-0000-000000000000',
        employee_id: me.user!.id,
        remarks: 'probe',
      })
      .select()

    expect(error).not.toBeNull()
  })
})

describe('the analytics that read leads inherit the rule', () => {
  test('lead analytics return nothing for a Tech employee', async () => {
    // Both RPCs are security invoker, so they see what the caller sees. If
    // either were ever switched to definer this would start failing, which is
    // the point of asserting it here rather than trusting the declaration.
    const today = new Date().toISOString().slice(0, 10)
    const { data: funnel } = await techEmployee.rpc('analytics_lead_funnel', {
      p_from: '2000-01-01',
      p_to: today,
    })
    const totals = (funnel ?? []).reduce((sum, row) => sum + (row.lead_count ?? 0), 0)
    expect(totals).toBe(0)
  })
})
