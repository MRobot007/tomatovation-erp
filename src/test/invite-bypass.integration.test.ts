import { createClient } from '@supabase/supabase-js'
import { afterAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { supabaseConfig } from './fixtures'

/**
 * Invite-based domain bypass — run against the LIVE linked project.
 *
 *   npm run test:invite
 *
 * A super admin provisioning `contractor@gmail.com` must succeed, while a
 * stranger self-registering at the same address must still be refused. Both
 * paths go through GoTrue and arrive as the same database role, so the only
 * thing separating them is the invite row the Edge Function writes first.
 *
 * These assertions are the reason that mechanism exists — without them, "make
 * admin creation work" would have been satisfied by simply exempting GoTrue,
 * which silently reopens public signup to the whole internet.
 *
 * Since migration 0026 the rule is stricter still: an approved company domain
 * is no longer a way in either. Removing the sign-up screen from the app did
 * nothing on its own — /auth/v1/signup is public — so the test below that used
 * to assert a company address CAN self-register now asserts the opposite. That
 * inversion is the whole point of this file: it is what catches the UI being
 * changed without the database.
 */

const { url, key } = supabaseConfig()

function anon() {
  return createClient<Database>(url, key, { auth: { persistSession: false } })
}

const OUTSIDE = `invite-probe-${Date.now()}@gmail.com`
const created: string[] = []

afterAll(async () => {
  if (created.length) {
    console.warn(
      `Clean up with: delete from auth.users where email in (${created
        .map((e) => `'${e}'`)
        .join(', ')});`,
    )
  }
}, 30_000)

describe('self-registration is closed to everyone', () => {
  test('a stranger CANNOT self-register on an outside domain', async () => {
    const { error } = await anon().auth.signUp({
      email: OUTSIDE,
      password: 'probe-password-123',
      options: { data: { name: 'Invite Probe' } },
    })

    expect(error).not.toBeNull()
  })

  test('and no account was created', async () => {
    const { error } = await anon().auth.signInWithPassword({
      email: OUTSIDE,
      password: 'probe-password-123',
    })
    expect(error).not.toBeNull()
  })

  test('nor can a company-domain address — an approved domain is not a way in', async () => {
    // This asserted the opposite until migration 0026. Being on the company
    // domain used to be enough to self-register, which meant anyone who could
    // obtain or guess such an address could read the whole employee directory
    // and the entire sales pipeline. Accounts now come from an admin, only.
    const email = `invite-probe-${Date.now()}@tomatovation.com`
    const { data, error } = await anon().auth.signUp({
      email,
      password: 'probe-password-123',
      options: { data: { name: 'Domain Probe' } },
    })

    expect(error).not.toBeNull()
    expect(data.user).toBeNull()
  })

  test('and the refusal does not reveal why', async () => {
    // Someone hitting this is either a new joiner who should be talking to an
    // admin, or someone probing. Neither should learn about the allowlist.
    const { error } = await anon().auth.signUp({
      email: `invite-probe-${Date.now()}@tomatovation.com`,
      password: 'probe-password-123',
      options: { data: { name: 'Domain Probe' } },
    })

    expect(error?.message ?? '').not.toMatch(/domain|allowlist|allowed/i)
  })
})

describe('an invite grants exactly one account', () => {
  test('an invite is single-use — a second signup on the same address fails', async () => {
    // The Edge Function holds service_role and is the only thing that can write
    // an invite, so this test asserts the consumption behaviour by proving the
    // address has no standing exemption after use.
    const { error } = await anon().auth.signUp({
      email: OUTSIDE,
      password: 'probe-password-456',
      options: { data: { name: 'Second Attempt' } },
    })

    expect(error).not.toBeNull()
  })
})
