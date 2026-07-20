import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskStatus = Database['public']['Enums']['task_status']
export type TaskPriority = Database['public']['Enums']['task_priority']

export interface TaskRow extends Task {
  assignee: { id: string; name: string; profile_photo: string | null } | null
  assigner: { id: string; name: string } | null
}

export interface TaskFilters {
  assignedTo?: string
  status?: TaskStatus | 'all'
  priority?: TaskPriority | 'all'
  search?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

const SORTABLE = new Set(['title', 'priority', 'status', 'deadline', 'created_at'])

export async function listTasks(filters: TaskFilters = {}): Promise<TaskRow[]> {
  let query = supabase
    .from('tasks')
    .select('*, assignee:assigned_to(id, name, profile_photo), assigner:assigned_by(id, name)')

  if (filters.assignedTo) query = query.eq('assigned_to', filters.assignedTo)
  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.priority && filters.priority !== 'all') query = query.eq('priority', filters.priority)

  if (filters.search?.trim()) {
    const safe = filters.search.trim().replace(/[,()]/g, ' ')
    query = query.or(`title.ilike.%${safe}%,description.ilike.%${safe}%`)
  }

  const column = filters.sortColumn && SORTABLE.has(filters.sortColumn) ? filters.sortColumn : 'created_at'
  query = query.order(column, {
    ascending: filters.sortDirection === 'asc',
    // Tasks with no deadline belong at the end of a deadline sort, not the top.
    nullsFirst: false,
  })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as TaskRow[]
}

export type TaskInsert = Pick<
  Database['public']['Tables']['tasks']['Insert'],
  'title' | 'description' | 'assigned_to' | 'assigned_by' | 'priority' | 'deadline' | 'status'
>

export async function createTask(input: TaskInsert): Promise<Task> {
  const { data, error } = await supabase.from('tasks').insert(input).select().single()
  if (error) throw error
  return data
}

export type TaskUpdate = Partial<Omit<TaskInsert, 'assigned_by'>>

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase.from('tasks').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

/**
 * completed_at is maintained by a trigger, so this only sends the status. The
 * check constraint keeps the two in step regardless of what a caller sends.
 */
export async function setTaskStatus(id: string, status: TaskStatus): Promise<Task> {
  return updateTask(id, { status })
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
