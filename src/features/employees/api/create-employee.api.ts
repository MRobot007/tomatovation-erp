import { invokeFunction } from '@/lib/invoke-function'
import type { Role } from '@/lib/roles'

export type CreateEmployeeInput = {
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
export function createEmployee(input: CreateEmployeeInput): Promise<CreatedEmployee> {
  return invokeFunction<CreatedEmployee>('create-employee', input)
}

export type ResetPasswordInput = {
  user_id: string
  /** Omit to have one generated, which is the better default. */
  password?: string
}

export interface ResetPasswordResult {
  id: string
  name: string
  email: string
  temporaryPassword: string
}

/**
 * Sets an employee's password without knowing their old one.
 *
 * Same reasoning as createEmployee: it needs the service_role key, so it runs
 * in an Edge Function that re-authorises the caller against the database.
 */
export function resetEmployeePassword(input: ResetPasswordInput): Promise<ResetPasswordResult> {
  return invokeFunction<ResetPasswordResult>('reset-employee-password', input)
}
