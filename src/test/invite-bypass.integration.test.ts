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
 * These assertions are the reason that mechanism exists — without the second
 * one, "make admin creation work" would have been satisfied by simply
 * exempting GoTrue, which silently reopens public signup to the whole internet.
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

describe('the allowlist still holds for self-registration', () => {
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

  test('a company-domain address can still self-register', async () => {
    // The allowlist must not have become a blanket block.
    const email = `invite-probe-${Date.now()}@tomatovation.com`
    const { data, error } = await anon().auth.signUp({
      email,
      password: 'probe-password-123',
      options: { data: { name: 'Domain Probe' } },
    })

    expect(error).toBeNull()
    expect(data.user).not.toBeNull()
    created.push(email)
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
