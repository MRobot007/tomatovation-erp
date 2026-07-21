import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { FIXTURE_EMAILS, fixturePassword, supabaseConfig } from './fixtures'

/**
 * reset-employee-password Edge Function — run against the LIVE linked project.
 *
 *   npm run test:reset-password
 *
 * This function sets someone else's password without knowing the old one. It
 * holds the service_role key and deliberately skips every check the profile
 * screen makes, so the super-admin gate in front of it is the ONLY thing
 * standing between a signed-in employee and taking over the founder's account.
 * These tests exist to prove that gate holds.
 *
 * The success path needs a super-admin login. There is no super-admin fixture
 * by default, so those tests skip themselves rather than passing silently —
 * see scripts/setup-rls-fixtures.mjs to provision one.
 */

const { url, key } = supabaseConfig()
const ENDPOINT = `${url}/functions/v1/reset-employee-password`

const ADMIN_EMAIL = 'rls-fixture-admin@example.com'

interface Caller {
  client: SupabaseClient<Database>
  token: string
  id: string
}

async function signIn(email: string): Promise<Caller | null> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: fixturePassword(),
  })
  if (error) return null
  return { client, token: data.session!.access_token, id: data.user!.id }
}

async function callAs(token: string | null, body: unknown) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json', apikey: key }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(body) })

  let payload: unknown = null
  try {
    payload = await response.json()
  } catch {
    /* non-JSON error body */
  }

  return { status: response.status, payload: payload as Record<string, unknown> | null }
}

let manager: Caller
let outsider: Caller
let target: Caller
let admin: Caller | null = null

beforeAll(async () => {
  const [m, o, t] = await Promise.all([
    signIn(FIXTURE_EMAILS.manager),
    signIn(FIXTURE_EMAILS.outsider),
    signIn(FIXTURE_EMAILS.a),
  ])
  if (!m || !o || !t) throw new Error('Fixture accounts are missing — run scripts/setup-rls-fixtures.mjs')
  manager = m
  outsider = o
  target = t

  admin = await signIn(ADMIN_EMAIL)
}, 60_000)

describe('authorisation', () => {
  test('an anonymous caller is rejected', async () => {
    const { status } = await callAs(null, { user_id: target.id })
    expect(status).toBe(401)
  })

  test('a plain employee is rejected', async () => {
    const { status, payload } = await callAs(outsider.token, { user_id: target.id })
    expect(status).toBe(403)
    expect(String(payload?.error)).toMatch(/super admin/i)
  })

  test('a MANAGER is rejected — this is super-admin only', async () => {
    // The obvious mistake is gating on is_manager(), which is true for both
    // roles. A manager holding the password to their reports' accounts is a
    // privilege they do not have.
    const { status } = await callAs(manager.token, { user_id: target.id })
    expect(status).toBe(403)
  })

  test('an employee cannot reset their OWN password this way either', async () => {
    // It would bypass the current-password check the profile screen makes.
    const { status } = await callAs(outsider.token, { user_id: outsider.id })
    expect(status).toBe(403)
  })

  test('the caller identity comes from the token, not the body', async () => {
    const { status } = await callAs(outsider.token, {
      user_id: target.id,
      caller_id: '00000000-0000-0000-0000-000000000000',
      is_super_admin: true,
      role: 'super_admin',
    })
    expect(status).toBe(403)
  })

  test('a rejected call does NOT change the password', async () => {
    // The assertion that matters: a 403 with the password already changed
    // would be far worse than a 403 alone, and the status code alone cannot
    // tell the two apart.
    const still = await signIn(FIXTURE_EMAILS.a)
    expect(still, 'the fixture password still works after the rejected calls').not.toBeNull()
  })
})

describe.skipIf(!process.env.RLS_FIXTURE_ADMIN)('as a super admin', () => {
  test('rejects a password below the minimum length', async () => {
    const { status, payload } = await callAs(admin!.token, {
      user_id: target.id,
      password: 'short',
    })
    expect(status).toBe(400)
    expect(String(payload?.error)).toMatch(/8 and 72/)
  })

  test('refuses an unknown employee id', async () => {
    const { status } = await callAs(admin!.token, {
      user_id: '00000000-0000-0000-0000-000000000000',
    })
    expect(status).toBe(404)
  })

  test('points a super admin at the profile screen for their own password', async () => {
    const { status, payload } = await callAs(admin!.token, { user_id: admin!.id })
    expect(status).toBe(400)
    expect(String(payload?.error)).toMatch(/Profile/i)
  })

  test('generates a working password when none is given, and it actually signs in', async () => {
    const { status, payload } = await callAs(admin!.token, { user_id: target.id })
    expect(status).toBe(200)

    const generated = String(payload?.temporaryPassword)
    expect(generated.length).toBeGreaterThanOrEqual(12)

    // The point of the whole feature. Asserting the 200 alone would pass even
    // if the password were never actually applied.
    const client = createClient<Database>(url, key, { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({
      email: FIXTURE_EMAILS.a,
      password: generated,
    })
    expect(error, 'the returned password must actually work').toBeNull()

    // Put it back, or every later run of the other suites fails to sign in.
    const restore = await callAs(admin!.token, {
      user_id: target.id,
      password: fixturePassword(),
    })
    expect(restore.status, 'failed to restore the fixture password').toBe(200)
  })

  test('the old password stops working once it is changed', async () => {
    const { status, payload } = await callAs(admin!.token, { user_id: target.id })
    expect(status).toBe(200)

    const client = createClient<Database>(url, key, { auth: { persistSession: false } })
    const { error } = await client.auth.signInWithPassword({
      email: FIXTURE_EMAILS.a,
      password: fixturePassword(),
    })
    expect(error, 'the previous password must no longer work').not.toBeNull()

    await callAs(admin!.token, { user_id: target.id, password: fixturePassword() })
    void payload
  })
})
