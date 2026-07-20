import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword } from './fixtures'

/**
 * Manager-scoping RLS — run against the LIVE linked project.
 *
 *   node scripts/setup-rls-fixtures.mjs   (once)
 *   npm run test:manager
 *
 * This is the boundary the whole authorisation model rests on, and it is the
 * one that cannot be tested with two unrelated accounts: it needs a real
 * reporting line. It exists because migration 0008 shipped a bug that silently
 * disabled every privilege guard while every other test still passed.
 *
 * Fixtures (created by the setup script, linked by direct SQL):
 *
 *   manager   role = 'manager'
 *   report    manager_id = manager.id     <- inside the boundary
 *   outsider  no relationship             <- outside the boundary
 *
 * Every assertion is made twice: the manager CAN reach their report, and CANNOT
 * reach the outsider. A policy that returns everything passes the first half.
 */

const url = process.env.VITE_SUPABASE_URL ?? ''
const key = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const PASSWORD = fixturePassword()

const EMAILS = {
  manager: 'rls-fixture-manager@example.com',
  report: 'rls-fixture-report@example.com',
  outsider: 'rls-fixture-outsider@example.com',
}

interface Actor {
  client: SupabaseClient<Database>
  id: string
}

async function signIn(email: string): Promise<Actor> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
  if (error) {
    throw new Error(`${email}: ${error.message}. Run: node scripts/setup-rls-fixtures.mjs`)
  }
  return { client, id: data.user.id }
}

let manager: Actor
let report: Actor
let outsider: Actor

/**
 * Dates are offset by a per-run seed.
 *
 * These fixtures are permanent accounts, so their rows accumulate across runs.
 * Re-using fixed dates makes the second run fail on the overlap guard, and an
 * approved leave cannot be deleted by its owner (by policy), so the suite
 * cannot simply clean up after itself. A fresh window per run sidesteps both.
 *
 * The seed only shifts which dates are used — no assertion depends on the
 * specific value, so the suite stays deterministic.
 */
const RUN_SEED = Date.now() % 4000

function dateFor(offset: number): string {
  const base = new Date(Date.UTC(2030, 0, 1))
  base.setUTCDate(base.getUTCDate() + RUN_SEED + offset)
  return base.toISOString().slice(0, 10)
}

beforeAll(async () => {
  if (!url || !key) throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set')

  manager = await signIn(EMAILS.manager)
  report = await signIn(EMAILS.report)
  outsider = await signIn(EMAILS.outsider)

  // Fail loudly rather than silently passing against an unlinked fixture set —
  // if manager_id is null, every "cannot see" assertion below would pass for
  // the wrong reason.
  const { data: profile } = await report.client
    .from('profiles')
    .select('manager_id')
    .eq('id', report.id)
    .single()

  if (profile?.manager_id !== manager.id) {
    throw new Error(
      'Fixture not linked: report.manager_id does not point at manager. Re-run the link SQL.',
    )
  }
}, 60_000)

describe('helper functions resolve the relationship', () => {
  test('the manager is recognised as a manager', async () => {
    const { data } = await manager.client.rpc('is_manager')
    expect(data).toBe(true)
  })

  test('an ordinary employee is not', async () => {
    const { data } = await outsider.client.rpc('is_manager')
    expect(data).toBe(false)
  })

  test('neither fixture is a super admin', async () => {
    expect((await manager.client.rpc('is_super_admin')).data).toBe(false)
    expect((await report.client.rpc('is_super_admin')).data).toBe(false)
  })

  test('manages() is true for the direct report and false for the outsider', async () => {
    expect((await manager.client.rpc('manages', { target: report.id })).data).toBe(true)
    expect((await manager.client.rpc('manages', { target: outsider.id })).data).toBe(false)
  })

  test('a report does not manage their own manager', async () => {
    expect((await report.client.rpc('manages', { target: manager.id })).data).toBe(false)
  })
})

describe('attendance', () => {
  beforeAll(async () => {
    await report.client
      .from('attendance')
      .upsert(
        {
          employee_id: report.id,
          date: dateFor(0),
          punch_in: `${dateFor(0)}T09:00:00+05:30`,
          punch_out: `${dateFor(0)}T18:00:00+05:30`,
          status: 'completed',
        },
        { onConflict: 'employee_id,date' },
      )

    await outsider.client
      .from('attendance')
      .upsert(
        {
          employee_id: outsider.id,
          date: dateFor(1),
          punch_in: `${dateFor(1)}T09:00:00+05:30`,
          punch_out: `${dateFor(1)}T18:00:00+05:30`,
          status: 'completed',
        },
        { onConflict: 'employee_id,date' },
      )
  }, 30_000)

  test('a manager CAN read their direct report', async () => {
    const { data, error } = await manager.client
      .from('attendance')
      .select('*')
      .eq('employee_id', report.id)

    expect(error).toBeNull()
    expect((data ?? []).length).toBeGreaterThan(0)
  })

  test('a manager CANNOT read someone outside their line', async () => {
    const { data } = await manager.client
      .from('attendance')
      .select('*')
      .eq('employee_id', outsider.id)

    expect(data ?? []).toHaveLength(0)
  })

  test('a report CANNOT read their own manager’s records', async () => {
    // Visibility flows down the reporting line, never up.
    const { data } = await report.client.from('attendance').select('*').eq('employee_id', manager.id)
    expect(data ?? []).toHaveLength(0)
  })

  test('an unrelated employee sees neither', async () => {
    const { data } = await outsider.client
      .from('attendance')
      .select('*')
      .in('employee_id', [manager.id, report.id])

    expect(data ?? []).toHaveLength(0)
  })

  test('a manager cannot edit a report’s attendance, only read it', async () => {
    const { data } = await manager.client
      .from('attendance')
      .update({ break_minutes: 999 })
      .eq('employee_id', report.id)
      .select()

    expect(data ?? []).toHaveLength(0)
  })
})

describe('work_logs and the reviewer guard', () => {
  let reportLogId: string

  beforeAll(async () => {
    const { data, error } = await report.client
      .from('work_logs')
      .insert({
        employee_id: report.id,
        log_date: dateFor(2),
        project: 'Manager scoping',
        task: 'Prove the boundary holds',
        hours: 4,
        status: 'submitted',
      })
      .select()
      .single()

    if (error) throw error
    reportLogId = data.id
  }, 30_000)

  test('a manager CAN read their report’s work log', async () => {
    const { data } = await manager.client.from('work_logs').select('*').eq('id', reportLogId)
    expect((data ?? []).length).toBe(1)
  })

  test('an outsider CANNOT', async () => {
    const { data } = await outsider.client.from('work_logs').select('*').eq('id', reportLogId)
    expect(data ?? []).toHaveLength(0)
  })

  test('a manager CAN record a review verdict', async () => {
    const { error } = await manager.client
      .from('work_logs')
      .update({
        status: 'reviewed',
        reviewed_by: manager.id,
        reviewed_at: new Date().toISOString(),
        review_comment: 'Looks good',
      })
      .eq('id', reportLogId)

    expect(error).toBeNull()
  })

  test('a reviewer CANNOT rewrite the content they are reviewing', async () => {
    // The guard trigger, not the policy — RLS cannot compare OLD to NEW.
    const { error } = await manager.client
      .from('work_logs')
      .update({ hours: 12, task: 'Rewritten by the reviewer' })
      .eq('id', reportLogId)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/review fields only/i)
  })

  test('the author CANNOT edit once reviewed', async () => {
    const { data } = await report.client
      .from('work_logs')
      .update({ hours: 2 })
      .eq('id', reportLogId)
      .select()

    expect(data ?? []).toHaveLength(0)
  })
})

describe('tasks and the assignee guard', () => {
  let taskId: string

  beforeAll(async () => {
    const { data, error } = await manager.client
      .from('tasks')
      .insert({
        title: 'Scoped task',
        assigned_to: report.id,
        assigned_by: manager.id,
        priority: 'medium',
        status: 'todo',
      })
      .select()
      .single()

    if (error) throw error
    taskId = data.id
  }, 30_000)

  test('a manager CAN assign work to a direct report', async () => {
    expect(taskId).toBeTruthy()
  })

  test('a manager CANNOT assign work to someone outside their line', async () => {
    const { error } = await manager.client.from('tasks').insert({
      title: 'Should be refused',
      assigned_to: outsider.id,
      assigned_by: manager.id,
    })

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/row-level security/i)
  })

  test('the assignee CAN move the status', async () => {
    const { error } = await report.client
      .from('tasks')
      .update({ status: 'in_progress' })
      .eq('id', taskId)

    expect(error).toBeNull()
  })

  test('the assignee CANNOT reassign the task', async () => {
    const { error } = await report.client
      .from('tasks')
      .update({ assigned_to: outsider.id })
      .eq('id', taskId)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/status only/i)
  })

  test('the assignee CANNOT rewrite the brief', async () => {
    const { error } = await report.client
      .from('tasks')
      .update({ title: 'Rewritten by the assignee' })
      .eq('id', taskId)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/status only/i)
  })

  test('an outsider cannot see the task at all', async () => {
    const { data } = await outsider.client.from('tasks').select('*').eq('id', taskId)
    expect(data ?? []).toHaveLength(0)
  })
})

describe('leave approval', () => {
  let leaveId: string

  beforeAll(async () => {
    const { data, error } = await report.client
      .from('leaves')
      .insert({
        employee_id: report.id,
        leave_type: 'casual',
        reason: 'Manager scoping verification',
        start_date: dateFor(40),
        end_date: dateFor(41),
      })
      .select()
      .single()

    if (error) throw error
    leaveId = data.id
  }, 30_000)

  test('a manager CAN see their report’s request', async () => {
    const { data } = await manager.client.from('leaves').select('*').eq('id', leaveId)
    expect((data ?? []).length).toBe(1)
  })

  test('an outsider CANNOT', async () => {
    const { data } = await outsider.client.from('leaves').select('*').eq('id', leaveId)
    expect(data ?? []).toHaveLength(0)
  })

  test('a manager CAN approve it, and the database stamps the approver', async () => {
    const { data, error } = await manager.client
      .from('leaves')
      .update({ status: 'approved' })
      .eq('id', leaveId)
      .select()
      .single()

    expect(error).toBeNull()
    // approved_by is set by the trigger, never sent by the client — so it
    // cannot be forged to name someone else.
    expect(data!.approved_by).toBe(manager.id)
    expect(data!.approved_at).not.toBeNull()
  })

  test('a manager CANNOT approve their own leave', async () => {
    const { data: own, error: insertError } = await manager.client
      .from('leaves')
      .insert({
        employee_id: manager.id,
        leave_type: 'casual',
        reason: 'Self approval attempt',
        start_date: dateFor(60),
        end_date: dateFor(60),
      })
      .select()
      .single()

    expect(insertError).toBeNull()

    const { error } = await manager.client
      .from('leaves')
      .update({ status: 'approved' })
      .eq('id', own!.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/cannot decide your own/i)
  })
})

describe('privilege escalation remains blocked for a manager', () => {
  test('a manager cannot promote themselves to super_admin', async () => {
    const { error } = await manager.client
      .from('profiles')
      .update({ role: 'super_admin' })
      .eq('id', manager.id)

    expect(error).not.toBeNull()
    expect(error?.message).toMatch(/super admin may change a role/i)
  })

  test('a manager cannot claim another employee as a report', async () => {
    const { data } = await manager.client
      .from('profiles')
      .update({ manager_id: manager.id })
      .eq('id', outsider.id)
      .select()

    expect(data ?? []).toHaveLength(0)
  })

  test('a manager still cannot read the audit log', async () => {
    const { data } = await manager.client.from('audit_logs').select('*').limit(5)
    expect(data ?? []).toHaveLength(0)
  })
})
