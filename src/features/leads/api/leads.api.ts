import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Lead = Database['public']['Tables']['leads']['Row']
export type LeadStatus = Database['public']['Enums']['lead_status']
export type LeadPriority = Database['public']['Enums']['lead_priority']
export type LeadSource = Database['public']['Enums']['lead_source']
export type LeadActivity = Database['public']['Tables']['lead_activities']['Row']

export interface LeadRow extends Lead {
  assignee: { id: string; name: string; profile_photo: string | null } | null
  creator: { id: string; name: string } | null
}

export interface LeadActivityRow extends LeadActivity {
  employee: { id: string; name: string; profile_photo: string | null } | null
}

export interface LeadFilters {
  status?: LeadStatus | 'all'
  priority?: LeadPriority | 'all'
  source?: LeadSource | 'all'
  assignedTo?: string | 'all'
  search?: string
  sortColumn?: string
  sortDirection?: 'asc' | 'desc'
}

const SORTABLE = new Set(['company', 'status', 'priority', 'next_followup', 'created_at', 'value_estimate'])

export async function listLeads(filters: LeadFilters = {}): Promise<LeadRow[]> {
  let query = supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, name, profile_photo), creator:created_by(id, name)')

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)
  if (filters.priority && filters.priority !== 'all') query = query.eq('priority', filters.priority)
  if (filters.source && filters.source !== 'all') query = query.eq('source', filters.source)
  if (filters.assignedTo && filters.assignedTo !== 'all') {
    query = filters.assignedTo === 'unassigned'
      ? query.is('assigned_to', null)
      : query.eq('assigned_to', filters.assignedTo)
  }

  if (filters.search?.trim()) {
    const safe = filters.search.trim().replace(/[,()]/g, ' ')
    query = query.or(
      `company.ilike.%${safe}%,contact_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%`,
    )
  }

  const column = filters.sortColumn && SORTABLE.has(filters.sortColumn) ? filters.sortColumn : 'created_at'
  query = query.order(column, { ascending: filters.sortDirection === 'asc', nullsFirst: false })

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeadRow[]
}

export async function getLead(id: string): Promise<LeadRow | null> {
  const { data, error } = await supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, name, profile_photo), creator:created_by(id, name)')
    .eq('id', id)
    .maybeSingle()

  if (error) throw error
  return data as LeadRow | null
}

/** Newest first — a timeline is read from the top. */
export async function listLeadActivities(leadId: string): Promise<LeadActivityRow[]> {
  const { data, error } = await supabase
    .from('lead_activities')
    .select('*, employee:employee_id(id, name, profile_photo)')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as LeadActivityRow[]
}

export type LeadInsert = Pick<
  Database['public']['Tables']['leads']['Insert'],
  | 'company'
  | 'contact_name'
  | 'phone'
  | 'email'
  | 'source'
  | 'assigned_to'
  | 'status'
  | 'priority'
  | 'value_estimate'
  | 'remarks'
  | 'next_followup'
  | 'created_by'
>

export async function createLead(input: LeadInsert): Promise<Lead> {
  const { data, error } = await supabase.from('leads').insert(input).select().single()
  if (error) throw error
  return data
}

/**
 * Bulk insert for the spreadsheet importer.
 *
 * Chunked because a single statement carrying a few thousand rows runs into the
 * request size limit, and because a failure then reports which chunk died
 * instead of just "the import failed". Chunks are sequential rather than
 * parallel: the rows arrive in file order, which is the order the user will
 * look for them in.
 *
 * This is NOT a transaction. A chunk that fails leaves earlier chunks inserted —
 * the caller reports how many landed so the user can fix the file and re-import
 * the rest, which the importer's duplicate check then helps with.
 */
export async function createLeads(rows: readonly LeadInsert[], chunkSize = 500): Promise<Lead[]> {
  const inserted: Lead[] = []

  for (let start = 0; start < rows.length; start += chunkSize) {
    const chunk = rows.slice(start, start + chunkSize)
    const { data, error } = await supabase.from('leads').insert(chunk).select()

    if (error) {
      const failed = new Error(
        inserted.length > 0
          ? `${error.message} — ${inserted.length} of ${rows.length} leads were already imported`
          : error.message,
      )
      throw Object.assign(failed, { insertedCount: inserted.length })
    }

    inserted.push(...(data ?? []))
  }

  return inserted
}

export type LeadUpdate = Partial<Omit<LeadInsert, 'created_by'>>

/**
 * Status and assignment changes write their own timeline entries via trigger,
 * so nothing here needs to log them — and a change made anywhere else still
 * appears in the history.
 */
export async function updateLead(id: string, patch: LeadUpdate): Promise<Lead> {
  const { data, error } = await supabase.from('leads').update(patch).eq('id', id).select().single()
  if (error) throw error
  return data
}

export async function deleteLead(id: string): Promise<void> {
  const { error } = await supabase.from('leads').delete().eq('id', id)
  if (error) throw error
}

export async function addLeadActivity(input: {
  lead_id: string
  employee_id: string
  activity: Database['public']['Enums']['lead_activity_kind']
  remarks: string | null
}): Promise<LeadActivity> {
  const { data, error } = await supabase.from('lead_activities').insert(input).select().single()
  if (error) throw error
  return data
}

/** Drives the "Follow-ups due today" widget. */
export async function listFollowupsDue(date: string, assignedTo?: string): Promise<LeadRow[]> {
  let query = supabase
    .from('leads')
    .select('*, assignee:assigned_to(id, name, profile_photo), creator:created_by(id, name)')
    .lte('next_followup', date)
    .not('status', 'in', '(won,lost)')
    .order('next_followup', { ascending: true })

  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as LeadRow[]
}
