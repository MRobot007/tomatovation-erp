import { supabase } from '@/lib/supabase'
import type { Role } from '@/lib/roles'

export interface CreateEmployeeInput {
  name: string
  email: string
  role: Role
  department: string | null
  manager_id: string | null
}

export interface CreatedEmployee {
  id: string
  email: string
  name: string
  temporaryPassword: string
}

/**
 * Provisions an account through the create-employee Edge Function.
 *
 * This cannot be done from the browser directly: creating an auth user needs
 * the service_role key, which bypasses RLS and must never reach a client. The
 * function holds it server-side and re-checks that the caller is a super admin
 * against the database — the role is read from the caller's JWT, not from
 * anything this module sends.
 */
export async function createEmployee(input: CreateEmployeeInput): Promise<CreatedEmployee> {
  const { data, error } = await supabase.functions.invoke<CreatedEmployee | { error: string }>(
    'create-employee',
    { body: input },
  )

  if (error) {
    // FunctionsHttpError carries the response, and the useful message is in the
    // body — the top-level error is only ever "Edge Function returned a
    // non-2xx status code", which tells the user nothing.
    const response = (error as { context?: Response }).context
    if (response) {
      try {
        const body = (await response.clone().json()) as { error?: string }
        if (body?.error) throw new Error(body.error)
      } catch (parsed) {
        if (parsed instanceof Error && parsed.message !== 'Unexpected end of JSON input') {
          throw parsed
        }
      }
    }
    throw new Error(error.message)
  }

  if (data && 'error' in data) throw new Error(data.error)
  if (!data) throw new Error('The server returned no response')

  return data
}
