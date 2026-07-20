/**
 * create-employee — provisions an account on behalf of a super admin.
 *
 * Creating an auth user requires the service_role key, which bypasses RLS
 * entirely and therefore can never be shipped to a browser. Supabase injects it
 * into the function environment, so it stays server-side and is never written
 * down anywhere.
 *
 * The caller's own JWT is verified against the database before anything is
 * created. The request body is NOT trusted to say who the caller is — that is
 * read from the token.
 *
 * Deploy:  supabase functions deploy create-employee
 */

import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const ROLES = ['super_admin', 'manager', 'employee'] as const
type Role = (typeof ROLES)[number]

interface Payload {
  name?: unknown
  email?: unknown
  role?: unknown
  department?: unknown
  manager_id?: unknown
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

/**
 * Crypto-random, not Math.random. This is a real credential that grants access
 * to employee records until it is changed.
 *
 * The alphabet omits characters that are easy to confuse when a password is
 * read aloud or copied off a screen: 0/O, 1/l/I.
 */
function temporaryPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!url || !serviceKey || !anonKey) {
    return json({ error: 'Function is not configured' }, 500)
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return json({ error: 'Not authenticated' }, 401)

  // --- Authorise the caller -------------------------------------------------
  // A client bound to the caller's JWT, so RLS applies exactly as it would in
  // the app. The role is read from the database, never from the request body.
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return json({ error: 'Not authenticated' }, 401)

  const { data: callerProfile } = await caller
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (callerProfile?.role !== 'super_admin') {
    return json({ error: 'Only a super admin can create employees' }, 403)
  }

  // --- Validate the payload -------------------------------------------------
  let body: Payload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role as Role
  const department = typeof body.department === 'string' ? body.department.trim() || null : null
  const managerId = typeof body.manager_id === 'string' && body.manager_id ? body.manager_id : null

  if (!name || name.length > 120) return json({ error: 'A name is required' }, 400)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400)
  if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400)

  // --- Create -------------------------------------------------------------
  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const password = temporaryPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // Confirmed on creation: an admin provisioning an account has already
    // established who the person is, and the built-in mailer is unreliable.
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError || !created.user) {
    const message = createError?.message ?? 'Could not create the account'
    const alreadyExists = /already (been )?registered|already exists/i.test(message)
    return json(
      { error: alreadyExists ? 'An account already exists for that email' : message },
      alreadyExists ? 409 : 400,
    )
  }

  // handle_new_user creates the profile row from the trigger. Give it a moment,
  // then apply the fields only an admin may set.
  await new Promise((resolve) => setTimeout(resolve, 300))

  const { error: profileError } = await admin
    .from('profiles')
    .update({ name, role, department, manager_id: managerId })
    .eq('id', created.user.id)

  if (profileError) {
    // Roll back rather than leaving an auth user with no usable profile —
    // they would be able to sign in and land on a broken account.
    await admin.auth.admin.deleteUser(created.user.id)
    return json({ error: `Could not set up the profile: ${profileError.message}` }, 500)
  }

  // The password is returned ONCE and never stored anywhere retrievable. If the
  // admin loses it, the employee uses the forgot-password flow.
  return json({ id: created.user.id, email, name, temporaryPassword: password }, 201)
})
