import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type WorkLog = Database['public']['Tables']['work_logs']['Row']
export type WorkLogStatus = Database['public']['Enums']['work_log_status']

export interface WorkLogRow extends WorkLog {
  employee: { id: string; name: string; profile_photo: string | null } | null
  reviewer: { id: string; name: string } | null
}

export interface WorkLogFilters {
  employeeId?: string
  status?: WorkLogStatus | 'all'
  from?: string
  to?: string
  search?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

const SORTABLE = new Set(['log_date', 'project', 'hours', 'status', 'created_at'])

/** RLS scopes the result: own rows, or a manager's reports, or everything. */
export async function listWorkLogs(filters: WorkLogFilters = {}): Promise<WorkLogRow[]> {
  let query = supabase
    .from('work_logs')
    .select('*, employee:employee_id(id, name, profile_photo), reviewer:reviewed_by(id, name)')

  if (filters.employeeId) query = query.eq('employee_id', filters.employeeId)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.from) query = query.gte('log_date', filters.from)
  if (filters.to) query = query.lte('log_date', filters.to)

  if (filters.search?.trim()) {
    const safe = filters.search.trim().replace(/[,()]/g, ' ')
    query = query.or(`project.ilike.%${safe}%,task.ilike.%${safe}%,description.ilike.%${safe}%`)
  }

  const column = filters.sortColumn && SORTABLE.has(filters.sortColumn) ? filters.sortColumn : 'log_date'
  query = query.order(column, { ascending: filters.sortDirection === 'asc' })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as WorkLogRow[]
}

export type WorkLogInsert = Pick<
  Database['public']['Tables']['work_logs']['Insert'],
  | 'employee_id'
  | 'log_date'
  | 'project'
  | 'task'
  | 'description'
  | 'hours'
  | 'status'
  | 'achievement'
  | 'tomorrow_plan'
  | 'attachment'
>

export async function createWorkLog(input: WorkLogInsert): Promise<WorkLog> {
  const { data, error } = await supabase.from('work_logs').insert(input).select().single()
  if (error) throw error
  return data
}

export type WorkLogUpdate = Omit<WorkLogInsert, 'employee_id'>

export async function updateWorkLog(id: string, patch: WorkLogUpdate): Promise<WorkLog> {
  const { data, error } = await supabase.from('work_logs').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteWorkLog(id: string): Promise<void> {
  const { error } = await supabase.from('work_logs').delete().eq('id', id)
  if (error) throw error
}

/**
 * Review is a separate call from edit, and touches only review fields. The
 * guard_work_log_review trigger rejects anything else from a non-author, so
 * bundling them would fail at the database anyway.
 */
export async function reviewWorkLog(
  id: string,
  reviewerId: string,
  verdict: 'reviewed' | 'needs_changes',
  comment: string | null,
): Promise<WorkLog> {
  const { data, error } = await supabase
    .from('work_logs')
    .update({
      status: verdict,
      reviewed_by: reviewerId,
      reviewed_at: new Date().toISOString(),
      review_comment: comment,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}
