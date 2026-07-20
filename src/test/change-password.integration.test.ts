import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword, supabaseConfig } from './fixtures'

/**
 * Password change — run against the LIVE linked project.
 *
 *   npm run test:password
 *
 * Uses the `outsider` fixture because this suite actually changes the account's
 * password. It always restores the original in afterAll, and the restore is
 * asserted, so a failure mid-suite cannot silently leave the fixture locked out
 * of every other suite that signs into it.
 */

const { url, key } = supabaseConfig()
const EMAIL = 'rls-fixture-outsider@example.com'
const ORIGINAL = fixturePassword()
const TEMP = `${ORIGINAL}-rotated`

function client(): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Mirrors changePassword() in auth.api.ts. */
async function changePassword(current: string, next: string) {
  const c = client()

  const verify = await c.auth.signInWithPassword({ email: EMAIL, password: current })
  if (verify.error) throw new Error('Your current password is not correct.')

  const { error } = await c.auth.updateUser({ password: next })
  if (error) throw error

  await c.auth.signOut({ scope: 'others' })
}

async function canSignIn(password: string): Promise<boolean> {
  const { error } = await client().auth.signInWithPassword({ email: EMAIL, password })
  return !error
}

beforeAll(async () => {
  if (!(await canSignIn(ORIGINAL))) {
    throw new Error(`${EMAIL} cannot sign in with the configured password. Check .env.local.`)
  }
}, 45_000)

afterAll(async () => {
  // Restore whichever password is currently live, so the fixture is always
  // usable by the other suites afterwards.
  if (await canSignIn(TEMP)) {
    await changePassword(TEMP, ORIGINAL)
  }

  const restored = await canSignIn(ORIGINAL)
  if (!restored) {
    throw new Error(
      `FIXTURE LEFT BROKEN: ${EMAIL} no longer accepts the configured password. ` +
        `Reset it with: select public.provision_account(...) or the SQL editor.`,
    )
  }
}, 45_000)

describe('the current password is required', () => {
  test('a wrong current password is rejected', async () => {
    // Supabase would accept updateUser({password}) on a live session alone.
    // Without this check, an unattended laptop is enough to lock the owner out.
    await expect(changePassword('definitely-not-the-password', TEMP)).rejects.toThrow(
      /current password is not correct/i,
    )
  })

  test('and the password is genuinely unchanged after that failure', async () => {
    expect(await canSignIn(ORIGINAL)).toBe(true)
    expect(await canSignIn(TEMP)).toBe(false)
  })
})

describe('a valid change', () => {
  test('succeeds with the correct current password', async () => {
    await expect(changePassword(ORIGINAL, TEMP)).resolves.not.toThrow()
  })

  test('the new password works', async () => {
    expect(await canSignIn(TEMP)).toBe(true)
  })

  test('the old password no longer works', async () => {
    // The assertion that actually matters — an "update" that leaves the old
    // credential valid is not a password change.
    expect(await canSignIn(ORIGINAL)).toBe(false)
  })

  test('can be changed back', async () => {
    await expect(changePassword(TEMP, ORIGINAL)).resolves.not.toThrow()
    expect(await canSignIn(ORIGINAL)).toBe(true)
    expect(await canSignIn(TEMP)).toBe(false)
  })
})
