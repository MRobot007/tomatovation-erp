/**
 * Caller authorisation for the Edge Functions.
 *
 * Both functions here hold the service_role key, which bypasses RLS entirely.
 * That makes the check in this file the only thing standing between a signed-in
 * employee and admin powers, so it reads the caller's identity from their JWT
 * and their role from the database — never from the request body, which the
 * caller controls.
 */

import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

export interface Env {
  url: string
  serviceKey: string
  anonKey: string
}

/** Supabase injects these; they are never written down in the repo. */
export function readEnv(): Env | null {
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')

  if (!url || !serviceKey || !anonKey) return null
  return { url, serviceKey, anonKey }
}

export interface Caller {
  id: string
  role: string
}

export type AuthResult = { caller: Caller } | { error: string; status: number }

/**
 * Resolves the caller from their bearer token and confirms they are a super
 * admin. The client is bound to the caller's JWT, so RLS applies exactly as it
 * would in the app while the role is read.
 */
export async function requireSuperAdmin(req: Request, env: Env): Promise<AuthResult> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return { error: 'Not authenticated', status: 401 }

  const caller = createClient(env.url, env.anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const { data: userData, error: userError } = await caller.auth.getUser()
  if (userError || !userData.user) return { error: 'Not authenticated', status: 401 }

  const { data: profile } = await caller
    .from('profiles')
    .select('role')
    .eq('id', userData.user.id)
    .maybeSingle()

  if (profile?.role !== 'super_admin') {
    return { error: 'Only a super admin can do that', status: 403 }
  }

  return { caller: { id: userData.user.id, role: profile.role } }
}

/** Service-role client. Bypasses RLS — only reachable past requireSuperAdmin. */
export function adminClient(env: Env): SupabaseClient {
  return createClient(env.url, env.serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
