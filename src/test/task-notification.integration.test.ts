import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword, supabaseConfig } from './fixtures'

/**
 * Task status notifications — run against the LIVE linked project.
 *
 *   npm run test:task-notify
 *
 * When an employee finishes a task, or gets blocked on one, the people
 * accountable for the work have to hear about it. Assignment already notified
 * the assignee; nothing fired the other way.
 *
 * The important assertions here are the negative ones. A notification system
 * that fires on everything gets muted, and a muted bell is worth less than no
 * bell — so these pin that routine progress stays quiet and that nobody is
 * told about their own action.
 */

const { url, key } = supabaseConfig()

interface Actor {
  client: SupabaseClient<Database>
  id: string
}

async function signIn(email: string): Promise<Actor> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: fixturePassword(),
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { client, id: data.user.id }
}

let manager: Actor
let report: Actor
const taskIds: string[] = []

/** Notifications the manager received for a given task. */
async function notificationsFor(taskId: string) {
  const { data } = await manager.client
    .from('notifications')
    .select('title, message, type, link')
    .eq('user_id', manager.id)
    .like('link', `%${taskId}%`)

  return data ?? []
}

async function createTask(title: string): Promise<string> {
  const { data, error } = await manager.client
    .from('tasks')
    .insert({
      title,
      assigned_to: report.id,
      assigned_by: manager.id,
      priority: 'medium',
      status: 'todo',
    })
    .select()
    .single()

  if (error) throw error
  taskIds.push(data.id)
  return data.id
}

beforeAll(async () => {
  manager = await signIn('rls-fixture-manager@example.com')
  report = await signIn('rls-fixture-report@example.com')
}, 60_000)

afterAll(async () => {
  for (const id of taskIds) {
    await manager.client.from('tasks').delete().eq('id', id)
  }
}, 30_000)

describe('the assigner is told when work finishes', () => {
  test('marking a task done notifies whoever assigned it', async () => {
    const taskId = await createTask('Notify on done')

    // Assert the update itself, not just its consequence. The first version of
    // this test ignored the error and only checked for notifications, so when
    // the trigger rejected the whole UPDATE ("DELETE requires a WHERE clause"
    // from pg_safeupdate) the failure looked like a missing notification rather
    // than a task that never changed status at all.
    const { data: updated, error } = await report.client
      .from('tasks')
      .update({ status: 'done' })
      .eq('id', taskId)
      .select()

    expect(error).toBeNull()
    expect(updated ?? []).toHaveLength(1)
    expect(updated![0]!.status).toBe('done')

    await new Promise((resolve) => setTimeout(resolve, 600))

    const notifications = await notificationsFor(taskId)
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.type).toBe('task_status_changed')
    expect(notifications[0]!.title).toMatch(/completed a task/i)
    expect(notifications[0]!.message).toBe('Notify on done')
  })

  test('the notification deep-links to the task', async () => {
    const taskId = taskIds[0]!
    const notifications = await notificationsFor(taskId)
    expect(notifications[0]!.link).toContain('/tasks?highlight=')
  })

  test('being blocked notifies too — it is the state that needs someone else', async () => {
    const taskId = await createTask('Notify on blocked')

    const { error } = await report.client
      .from('tasks')
      .update({ status: 'blocked' })
      .eq('id', taskId)

    expect(error).toBeNull()
    await new Promise((resolve) => setTimeout(resolve, 600))

    const notifications = await notificationsFor(taskId)
    expect(notifications).toHaveLength(1)
    expect(notifications[0]!.title).toMatch(/blocked/i)
  })
})

describe('routine progress stays quiet', () => {
  test('moving to in_progress notifies nobody', async () => {
    // The assignee getting on with their work. Notifying here would train
    // everyone to ignore the bell.
    const taskId = await createTask('No notify on in_progress')

    await report.client.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(await notificationsFor(taskId)).toHaveLength(0)
  })

  test('an update that does not change status notifies nobody', async () => {
    const taskId = taskIds[taskIds.length - 1]!

    await report.client.from('tasks').update({ status: 'in_progress' }).eq('id', taskId)
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(await notificationsFor(taskId)).toHaveLength(0)
  })
})

describe('nobody is notified about their own action', () => {
  test('a manager completing their own assigned task does not notify themselves', async () => {
    const { data: own, error } = await manager.client
      .from('tasks')
      .insert({
        title: 'Self assigned',
        assigned_to: manager.id,
        assigned_by: manager.id,
        priority: 'low',
        status: 'todo',
      })
      .select()
      .single()

    expect(error).toBeNull()
    taskIds.push(own!.id)

    await manager.client.from('tasks').update({ status: 'done' }).eq('id', own!.id)
    await new Promise((resolve) => setTimeout(resolve, 600))

    expect(await notificationsFor(own!.id)).toHaveLength(0)
  })
})

describe('tasks_needing_attention', () => {
  test('surfaces blocked work to the manager', async () => {
    const { data, error } = await manager.client.rpc('tasks_needing_attention', { p_limit: 20 })

    expect(error).toBeNull()
    const blocked = (data ?? []).filter((row) => row.status === 'blocked')
    expect(blocked.length).toBeGreaterThan(0)
  })

  test('blocked sorts above recently completed', async () => {
    const { data } = await manager.client.rpc('tasks_needing_attention', { p_limit: 20 })
    const rows = data ?? []

    const firstDone = rows.findIndex((row) => row.status === 'done')
    const lastBlocked = rows.map((row) => row.status).lastIndexOf('blocked')

    if (firstDone !== -1 && lastBlocked !== -1) {
      expect(lastBlocked).toBeLessThan(firstDone)
    }
  })

  test('an employee sees nothing — this is a manager view', async () => {
    const { data } = await report.client.rpc('tasks_needing_attention', { p_limit: 20 })
    // RLS scopes the underlying tables; a report manages nobody.
    expect((data ?? []).filter((row) => row.assignee_id !== report.id)).toHaveLength(0)
  })
})
