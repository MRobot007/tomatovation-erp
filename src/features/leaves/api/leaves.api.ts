import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Leave = Database['public']['Tables']['leaves']['Row']
export type LeaveStatus = Database['public']['Enums']['leave_status']
export type LeaveType = Database['public']['Enums']['leave_type']

export interface LeaveRow extends Leave {
  employee: { id: string; name: string; profile_photo: string | null } | null
  approver: { id: string; name: string } | null
}

export interface LeaveFilters {
  employeeId?: string
  status?: LeaveStatus | 'all'
  type?: LeaveType | 'all'
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

const SORTABLE = new Set(['start_date', 'end_date', 'status', 'leave_type', 'created_at'])

export async function listLeaves(filters: LeaveFilters = {}): Promise<LeaveRow[]> {
  let query = supabase
    .from('leaves')
    .select('*, employee:employee_id(id, name, profile_photo), approver:approved_by(id, name)')

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.type && filters.type !== 'all') query = query.eq('leave_type', filters.type)

  const column =
    filters.sortColumn && SORTABLE.has(filters.sortColumn) ? filters.sortColumn : 'start_date'
  query = query.order(column, { ascending: filters.sortDirection === 'asc' })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeaveRow[]
}

export type LeaveInsert = Pick<
  Database['public']['Tables']['leaves']['Insert'],
  'employee_id' | 'leave_type' | 'reason' | 'start_date' | 'end_date' | 'attachment'
>

export async function requestLeave(input: LeaveInsert): Promise<Leave> {
  const { data, error } = await supabase
    .from('leaves')
    // status is omitted deliberately: the insert policy requires 'pending', and
    // the default supplies it. A request cannot be born approved.
    .insert(input)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateLeaveRequest(
  id: string,
  patch: Omit<LeaveInsert, 'employee_id'>,
): Promise<Leave> {
  const { data, error } = await supabase.from('leaves').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/**
 * approved_by and approved_at are stamped by the guard_leave_decision trigger,
 * not sent from here — a client must not be able to claim someone else made the
 * decision. The trigger also blocks self-approval for every role.
 */
export async function decideLeave(
  id: string,
  status: 'approved' | 'rejected',
  note: string | null,
): Promise<Leave> {
  const { data, error } = await supabase
    .from('leaves')
    .update({ status, decision_note: note })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function cancelLeave(id: string): Promise<Leave> {
  const { data, error } = await supabase
    .from('leaves')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteLeave(id: string): Promise<void> {
  const { error } = await supabase.from('leaves').delete().eq('id', id)
  if (error) throw error
}

/** Working days in a range, computed by Postgres so the UI and reports agree. */
export async function countWorkingDays(start: string, end: string): Promise<number> {
  const { data, error } = await supabase.rpc('leave_working_days', { p_start: start, p_end: end })
  if (error) throw error
  return data ?? 0
}
