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

import { json, corsHeaders, temporaryPassword } from '../_shared/http.ts'
import { readEnv, requireSuperAdmin, adminClient } from '../_shared/auth.ts'

const ROLES = ['super_admin', 'manager', 'employee'] as const
type Role = (typeof ROLES)[number]

interface Payload {
  name?: unknown
  email?: unknown
  role?: unknown
  department?: unknown
  manager_id?: unknown
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const env = readEnv()
  if (!env) return json({ error: 'Function is not configured' }, 500, req)

  const auth = await requireSuperAdmin(req, env)
  if ('error' in auth) {
    return json(
      { error: auth.status === 403 ? 'Only a super admin can create employees' : auth.error },
      auth.status,
      req,
    )
  }

  // --- Validate the payload -------------------------------------------------
  let body: Payload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const role = body.role as Role
  const department = typeof body.department === 'string' ? body.department.trim() || null : null
  const managerId = typeof body.manager_id === 'string' && body.manager_id ? body.manager_id : null

  if (!name || name.length > 120) return json({ error: 'A name is required' }, 400, req)
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return json({ error: 'A valid email is required' }, 400, req)
  if (!ROLES.includes(role)) return json({ error: 'Invalid role' }, 400, req)

  // --- Create -------------------------------------------------------------
  const admin = adminClient(env)

  const password = temporaryPassword()

  // Record the invite BEFORE creating the user.
  //
  // enforce_signup_domain runs on auth.users and would otherwise refuse the
  // insert: self-signup is closed, so an invite is the only way in. The trigger
  // cannot tell this call apart from a direct one, because both are GoTrue and
  // arrive as the same database role. The invite row is how the intent is
  // communicated. It is single-use: the trigger consumes it.
  const { error: inviteError } = await admin
    .from('invited_emails')
    .upsert(
      { email, invited_by: auth.caller.id, expires_at: new Date(Date.now() + 600_000).toISOString() },
      { onConflict: 'email' },
    )

  if (inviteError) {
    return json({ error: `Could not record the invite: ${inviteError.message}` }, 500, req)
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    // Confirmed on creation: an admin provisioning an account has already
    // established who the person is, and the built-in mailer is unreliable.
    email_confirm: true,
    user_metadata: { name },
  })

  if (createError || !created.user) {
    // The invite was not consumed, so clear it rather than leaving a standing
    // exemption for an address that has no account.
    await admin.from('invited_emails').delete().eq('email', email)

    const message = createError?.message ?? 'Could not create the account'
    const alreadyExists = /already (been )?registered|already exists/i.test(message)
    return json(
      { error: alreadyExists ? 'An account already exists for that email' : message },
      alreadyExists ? 409 : 400,
      req,
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
    return json({ error: `Could not set up the profile: ${profileError.message}` }, 500, req)
  }

  // The password is returned ONCE and never stored anywhere retrievable. If the
  // admin loses it, they can reset it from the employees list.
  return json({ id: created.user.id, email, name, temporaryPassword: password }, 201, req)
})
