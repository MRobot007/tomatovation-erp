import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { FIXTURE_EMAILS, fixturePassword, supabaseConfig } from './fixtures'

/**
 * Multiple punch-in sessions in a day — run against the LIVE linked project.
 *
 *   npm run test:sessions
 *
 * Exercises the RPCs the way the app does, rather than writing rows directly:
 * punching out used to be final, and the whole point of this change is that it
 * is not. The SQL suite covers the arithmetic; this covers the round trip and
 * the guards on it.
 *
 * Leaves today's row for the fixture employee closed, which is the state any
 * other suite would expect to find.
 */

const { url, key } = supabaseConfig()

let client: SupabaseClient<Database>

async function signIn(email: string) {
  const c = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { error } = await c.auth.signInWithPassword({ email, password: fixturePassword() })
  if (error) throw new Error(`${email}: ${error.message}`)
  return c
}

/**
 * Sessions from earlier runs stay on the fixture's day — the attendance row is
 * one per day, but sessions accumulate under it. Counting them all made the
 * assertion below pass only against a clean database, so everything is
 * filtered to the sessions this run created.
 */
let runStartedAt: string

beforeAll(async () => {
  client = await signIn(FIXTURE_EMAILS.b)

  // Start from a known state: whatever a previous run or a real punch left
  // open, close it, so the first assertion below is about this test.
  await client.rpc('punch_out')

  // A second of slack, so a session opened in the same tick is not excluded by
  // clock skew between this machine and the database.
  runStartedAt = new Date(Date.now() - 1000).toISOString()
}, 60_000)

afterAll(async () => {
  await client.rpc('punch_out')
}, 30_000)

describe('a second punch-in on the same day', () => {
  test('the first punch in opens the day', async () => {
    const { data, error } = await client.rpc('punch_in')
    expect(error).toBeNull()
    expect(data?.punch_in).not.toBeNull()
    expect(data?.status).toBe('working')
  })

  test('punching in twice without punching out is a no-op, not an error', async () => {
    // This originally asserted a refusal, and the attendance suite caught the
    // contradiction: punch_in has been idempotent since migration 0003, and a
    // double-clicked button should not produce an error toast. The unique
    // partial index still prevents two OPEN sessions — the guard is about the
    // data, not about scolding the user.
    const { data: before } = await client
      .from('attendance_sessions')
      .select('id')
      .gte('punch_in', runStartedAt)

    const { error } = await client.rpc('punch_in')
    expect(error, 'a second punch in must not error').toBeNull()

    const { data: after } = await client
      .from('attendance_sessions')
      .select('id')
      .gte('punch_in', runStartedAt)

    expect((after ?? []).length, 'and must not open a second session').toBe(
      (before ?? []).length,
    )
  })

  test('punching out closes the day', async () => {
    const { data, error } = await client.rpc('punch_out')
    expect(error).toBeNull()
    expect(data?.punch_out).not.toBeNull()
    expect(data?.status).toBe('completed')
  })

  test('punching in AGAIN reopens the same day — this used to be impossible', async () => {
    const { data, error } = await client.rpc('punch_in')

    expect(error, 'a second punch in must be allowed').toBeNull()
    expect(data?.status).toBe('working')
    // Reopened, so the day has no closing time and no total yet.
    expect(data?.punch_out).toBeNull()
    expect(data?.working_hours).toBeNull()
  })

  test('the day still opens at the FIRST punch in of the morning', async () => {
    // Lateness is judged on when you first arrived, so the second punch-in
    // must not move it — otherwise coming back from lunch would erase being
    // late, which is precisely the hole migration 0015 was written to close.
    // Scoped to today's row, and NOT to this run: the claim is that the day
    // opens at the first session OF THE DAY. Filtering the sessions to this
    // run compared today's opening time against a session from a previous one,
    // which is a different — and false — statement.
    const { data: days } = await client
      .from('attendance')
      .select('id, punch_in')
      .order('date', { ascending: false })
      .limit(1)

    const day = days?.[0]
    const { data: sessions } = await client
      .from('attendance_sessions')
      .select('punch_in')
      .eq('attendance_id', day!.id)
      .order('punch_in', { ascending: true })

    const firstSession = sessions?.[0]?.punch_in
    const dayOpenedAt = day?.punch_in

    expect(firstSession).toBeTruthy()
    expect(dayOpenedAt).toBeTruthy()
    expect(new Date(dayOpenedAt as string).toISOString()).toBe(
      new Date(firstSession as string).toISOString(),
    )
  })

  test('every session is recorded, not just the latest', async () => {
    const { data, error } = await client
      .from('attendance_sessions')
      .select('id, punch_in, punch_out')
      .gte('punch_in', runStartedAt)
      .order('punch_in', { ascending: true })

    expect(error).toBeNull()
    // Two completed punch-in/out pairs from the tests above. Exact rather than
    // "at least": a stray extra session would mean a punch went somewhere
    // unexpected, which is worth failing on.
    expect((data ?? []).length).toBe(2)
    expect(data?.[0]?.punch_out, 'the morning session must be closed').not.toBeNull()
  })

  test('punching out with nothing open is refused', async () => {
    await client.rpc('punch_out')
    const { error } = await client.rpc('punch_out')
    expect(error).not.toBeNull()
  })
})

describe('sessions are not writable by hand', () => {
  test('an employee cannot insert their own session', async () => {
    // The same reasoning as migration 0015: a writable timestamp is a
    // backdated punch-in, and a backdated punch-in erases being late.
    const { data: me } = await client.auth.getUser()
    const { error } = await client
      .from('attendance_sessions')
      .insert({
        attendance_id: '00000000-0000-0000-0000-000000000000',
        employee_id: me.user!.id,
        punch_in: new Date().toISOString(),
      })
      .select()

    expect(error).not.toBeNull()
  })

  test('an employee cannot edit a session they own', async () => {
    const { data: sessions } = await client.from('attendance_sessions').select('id').limit(1)
    const id = sessions?.[0]?.id
    if (!id) return

    const { data } = await client
      .from('attendance_sessions')
      .update({ punch_in: '2020-01-01T00:00:00Z' })
      .eq('id', id)
      .select()

    // No update policy, so RLS matches nothing rather than erroring.
    expect(data ?? []).toEqual([])
  })
})
