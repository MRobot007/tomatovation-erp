import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { Role } from '@/lib/roles'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type EmployeeStatus = Database['public']['Enums']['employee_status']

/** A profile joined to its manager's display fields, for the roster. */
export interface EmployeeRow extends Profile {
  manager: Pick<Profile, 'id' | 'name'> | null
}

export interface EmployeeFilters {
  search?: string
  role?: Role | 'all'
  status?: EmployeeStatus | 'all'
  department?: string | 'all'
  managerId?: string | 'all'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

/** Whitelist, because the sort column arrives from the URL. */
const SORTABLE = new Set(['name', 'email', 'role', 'department', 'status', 'created_at'])

export async function listEmployees(filters: EmployeeFilters = {}): Promise<EmployeeRow[]> {
  let query = supabase
    .from('profiles')
    .select('*, manager:manager_id(id, name)')

  if (filters.search?.trim()) {
    const term = filters.search.trim()
    // Escape the PostgREST or() separators; an unescaped comma or paren in the
    // search box would otherwise be parsed as filter syntax.
    const safe = term.replace(/[,()]/g, ' ')
    query = query.or(`name.ilike.%${safe}%,email.ilike.%${safe}%,department.ilike.%${safe}%`)
  }

  if (filters.role && filters.role !== 'all') query = query.eq('role', filters.role)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.department && filters.department !== 'all') {
    query = query.eq('department', filters.department)
  }
  if (filters.managerId && filters.managerId !== 'all') {
    query = query.eq('manager_id', filters.managerId)
  }

  const column = filters.sortColumn && SORTABLE.has(filters.sortColumn) ? filters.sortColumn : 'name'
  query = query.order(column, { ascending: filters.sortDirection !== 'desc' })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as EmployeeRow[]
}

export async function getEmployee(id: string): Promise<EmployeeRow | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, manager:manager_id(id, name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as EmployeeRow | null
}

export type EmployeeUpdate = Pick<
  Database['public']['Tables']['profiles']['Update'],
  'name' | 'role' | 'department' | 'manager_id' | 'phone' | 'status' | 'profile_photo'
>

export async function updateEmployee(id: string, patch: EmployeeUpdate): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Deactivation, not deletion. Removing a profile would orphan attendance
 * history and audit rows, and there is no DELETE policy on profiles for
 * exactly that reason.
 */
export async function setEmployeeStatus(id: string, status: EmployeeStatus): Promise<Profile> {
  return updateEmployee(id, { status })
}

/** Candidate managers for the assignment picker. */
export async function listManagerCandidates(): Promise<Array<Pick<Profile, 'id' | 'name' | 'role'>>> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role')
    .in('role', ['manager', 'super_admin'])
    .eq('status', 'active')
    .order('name')

  if (error) throw error
  return data ?? []
}

/** Distinct departments, for the filter dropdown. */
export async function listDepartments(): Promise<string[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('department')
    .not('department', 'is', null)
    .order('department')

  if (error) throw error
  return [...new Set((data ?? []).map((row) => row.department).filter((d): d is string => Boolean(d)))]
}

export interface ManagerWithReports {
  manager: Pick<Profile, 'id' | 'name' | 'email' | 'department' | 'profile_photo'>
  reports: Array<Pick<Profile, 'id' | 'name' | 'profile_photo' | 'status'>>
}

/**
 * Two queries, then joined in memory. A per-manager query would be N+1, and the
 * whole roster is bounded at a few hundred rows by the spec.
 */
export async function listManagersWithReports(): Promise<ManagerWithReports[]> {
  const [{ data: managers, error: managerError }, { data: reports, error: reportError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, name, email, department, profile_photo')
        .in('role', ['manager', 'super_admin'])
        .order('name'),
      supabase
        .from('profiles')
        .select('id, name, profile_photo, status, manager_id')
        .not('manager_id', 'is', null),
    ])

  if (managerError) throw managerError
  if (reportError) throw reportError

  const byManager = new Map<string, ManagerWithReports['reports']>()
  for (const report of reports ?? []) {
    if (!report.manager_id) continue
    const bucket = byManager.get(report.manager_id) ?? []
    bucket.push({
      id: report.id,
      name: report.name,
      profile_photo: report.profile_photo,
      status: report.status,
    })
    byManager.set(report.manager_id, bucket)
  }

  return (managers ?? []).map((manager) => ({
    manager,
    reports: byManager.get(manager.id) ?? [],
  }))
}
