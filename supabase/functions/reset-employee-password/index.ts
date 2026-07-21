/**
 * reset-employee-password — sets an employee's password on behalf of a super admin.
 *
 * Changing another user's password requires the service_role key, which
 * bypasses RLS entirely and can never be shipped to a browser. Supabase injects
 * it into the function environment, so it stays server-side.
 *
 * Unlike the self-service flow in the app, this deliberately does NOT ask for
 * the target's current password — the whole point is that nobody knows it. That
 * makes the super-admin check the only guard, so it is done against the
 * database using the caller's own JWT, never anything in the request body.
 *
 * Deploy:  supabase functions deploy reset-employee-password
 */

import { json, corsHeaders, temporaryPassword } from '../_shared/http.ts'
import { readEnv, requireSuperAdmin, adminClient } from '../_shared/auth.ts'

/** Matches the app's own policy; 72 is bcrypt's ceiling, not an arbitrary cap. */
const MIN_PASSWORD = 8
const MAX_PASSWORD = 72

interface Payload {
  user_id?: unknown
  password?: unknown
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const env = readEnv()
  if (!env) return json({ error: 'Function is not configured' }, 500, req)

  const auth = await requireSuperAdmin(req, env)
  if ('error' in auth) {
    return json(
      { error: auth.status === 403 ? 'Only a super admin can reset a password' : auth.error },
      auth.status,
      req,
    )
  }

  let body: Payload
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400, req)
  }

  const userId = typeof body.user_id === 'string' ? body.user_id.trim() : ''
  if (!userId) return json({ error: 'Which employee? user_id is required' }, 400, req)

  // A chosen password is optional. Left out, one is generated — which is the
  // better default, since a password an admin invents is one they can guess.
  const chosen = typeof body.password === 'string' ? body.password : ''
  if (chosen && (chosen.length < MIN_PASSWORD || chosen.length > MAX_PASSWORD)) {
    return json(
      { error: `A password must be between ${MIN_PASSWORD} and ${MAX_PASSWORD} characters` },
      400,
      req,
    )
  }

  // Resetting your own password this way would skip the current-password check
  // that the profile screen enforces. Nudge rather than silently allow it.
  if (userId === auth.caller.id) {
    return json(
      { error: 'To change your own password, use Profile → Change password' },
      400,
      req,
    )
  }

  const admin = adminClient(env)

  // Read the target first: it confirms the id is a real employee and gives the
  // response something to name, so the UI never says "password reset" without
  // being able to say whose.
  const { data: target, error: targetError } = await admin
    .from('profiles')
    .select('id, name, email')
    .eq('id', userId)
    .maybeSingle()

  if (targetError) return json({ error: `Could not look up the employee: ${targetError.message}` }, 500, req)
  if (!target) return json({ error: 'No employee found with that id' }, 404, req)

  const password = chosen || temporaryPassword()

  const { error: updateError } = await admin.auth.admin.updateUserById(userId, { password })
  if (updateError) {
    return json({ error: updateError.message || 'Could not set the password' }, 400, req)
  }

  // Audited because it is an account takeover by design: afterwards the admin
  // knows a credential for someone else's account. The password itself is of
  // course never recorded — only that it was changed, and by whom.
  await admin.from('audit_logs').insert({
    user_id: auth.caller.id,
    action: 'update',
    module: 'auth.password_reset',
    record_id: target.id,
    new_data: { email: target.email, generated: chosen === '' },
  })

  // Returned ONCE and stored nowhere retrievable.
  return json(
    { id: target.id, name: target.name, email: target.email, temporaryPassword: password },
    200,
    req,
  )
})
