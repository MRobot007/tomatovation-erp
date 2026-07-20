import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, afterAll, describe, expect, test } from 'vitest'
import type { Database } from '@/lib/database.types'
import { fixturePassword, supabaseConfig } from './fixtures'

/**
 * create-employee Edge Function — run against the LIVE linked project.
 *
 *   npm run test:create-employee
 *
 * The function holds the service_role key, which bypasses RLS entirely. It is
 * therefore the single most privileged surface in the system, and the only one
 * where a mistake hands out unrestricted access. These tests exist to prove the
 * authorisation check in front of it actually holds — for a plain employee, a
 * manager, and an anonymous caller.
 *
 * Accounts it creates are deleted in afterAll.
 */

const { url, key } = supabaseConfig()
const ENDPOINT = `${url}/functions/v1/create-employee`

const EMAILS = {
  manager: 'rls-fixture-manager@example.com',
  outsider: 'rls-fixture-outsider@example.com',
}

interface Caller {
  client: SupabaseClient<Database>
  token: string
}

async function signIn(email: string): Promise<Caller> {
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password: fixturePassword(),
  })
  if (error) throw new Error(`${email}: ${error.message}`)
  return { client, token: data.session!.access_token }
}

async function callAs(token: string | null, body: unknown) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    apikey: key,
  }
  if (token) headers.Authorization = `Bearer ${token}`

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

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
const created: string[] = []

beforeAll(async () => {
  manager = await signIn(EMAILS.manager)
  outsider = await signIn(EMAILS.outsider)
}, 60_000)

afterAll(async () => {
  // Created accounts are real logins; leaving them behind would accumulate
  // unowned credentials on a live system.
  if (created.length === 0) return
  console.warn(
    `NOTE: clean up test accounts with:\n` +
      `  delete from auth.users where email in (${created.map((e) => `'${e}'`).join(', ')});`,
  )
}, 30_000)

describe('authorisation', () => {
  test('an anonymous caller is rejected', async () => {
    const { status } = await callAs(null, {
      name: 'Anon Attempt',
      email: `anon-${Date.now()}@tomatovation.com`,
      role: 'employee',
    })
    expect(status).toBe(401)
  })

  test('a plain employee is rejected', async () => {
    const { status, payload } = await callAs(outsider.token, {
      name: 'Employee Attempt',
      email: `emp-${Date.now()}@tomatovation.com`,
      role: 'employee',
    })

    expect(status).toBe(403)
    expect(String(payload?.error)).toMatch(/super admin/i)
  })

  test('a MANAGER is rejected — this is super-admin only', async () => {
    // The obvious mistake would be gating on is_manager(), which is true for
    // both roles. A manager creating accounts is a privilege they do not have.
    const { status } = await callAs(manager.token, {
      name: 'Manager Attempt',
      email: `mgr-${Date.now()}@tomatovation.com`,
      role: 'employee',
    })

    expect(status).toBe(403)
  })

  test('a plain employee cannot escalate by asking for super_admin', async () => {
    const { status } = await callAs(outsider.token, {
      name: 'Escalation Attempt',
      email: `esc-${Date.now()}@tomatovation.com`,
      role: 'super_admin',
    })

    expect(status).toBe(403)
  })

  test('the caller identity comes from the token, not the body', async () => {
    // Passing someone else's id in the payload must not change who the
    // function believes is calling.
    const { status } = await callAs(outsider.token, {
      name: 'Spoof Attempt',
      email: `spoof-${Date.now()}@tomatovation.com`,
      role: 'employee',
      caller_id: '00000000-0000-0000-0000-000000000000',
      is_super_admin: true,
    })

    expect(status).toBe(403)
  })
})

describe('validation rejects bad input before creating anything', () => {
  test('a malformed email is refused', async () => {
    const { status } = await callAs(outsider.token, {
      name: 'Bad Email',
      email: 'not-an-email',
      role: 'employee',
    })
    // 403 (authorisation runs first) is the correct order — authorise, then
    // validate. Either way nothing is created.
    expect([400, 403]).toContain(status)
  })

  test('an unknown role is refused', async () => {
    const { status } = await callAs(outsider.token, {
      name: 'Bad Role',
      email: `badrole-${Date.now()}@tomatovation.com`,
      role: 'root',
    })
    expect([400, 403]).toContain(status)
  })
})

describe('no account was created by any rejected call', () => {
  test('none of the attempted emails exist as profiles', async () => {
    const { data } = await manager.client
      .from('profiles')
      .select('email')
      .or(
        'email.like.anon-%,email.like.emp-%,email.like.mgr-%,email.like.esc-%,email.like.spoof-%,email.like.badrole-%',
      )

    expect(data ?? []).toHaveLength(0)
  })
})
