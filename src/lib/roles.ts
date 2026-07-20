export const ROLES = ['super_admin', 'manager', 'employee'] as const
export type Role = (typeof ROLES)[number]

export const ROLE_LABELS: Record<Role, string> = {
  super_admin: 'Super Admin',
  manager: 'Manager',
  employee: 'Employee',
}

/**
 * Ordered least -> most privileged. Used for "at least this role" checks so
 * call sites never enumerate roles by hand and drift apart.
 */
const ROLE_RANK: Record<Role, number> = {
  employee: 0,
  manager: 1,
  super_admin: 2,
}

export function hasRole(role: Role | null | undefined, allowed: readonly Role[]): boolean {
  return role != null && allowed.includes(role)
}

export function atLeast(role: Role | null | undefined, minimum: Role): boolean {
  if (role == null) return false
  return ROLE_RANK[role] >= ROLE_RANK[minimum]
}

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}
