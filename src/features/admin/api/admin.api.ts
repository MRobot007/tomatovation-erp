import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export type Announcement = Database['public']['Tables']['announcements']['Row']

export interface AnnouncementRow extends Announcement {
  author: { id: string; name: string; profile_photo: string | null } | null
}

export async function listAnnouncements(): Promise<AnnouncementRow[]> {
  const { data, error } = await supabase
    .from('announcements')
    .select('*, author:created_by(id, name, profile_photo)')
    .order('created_at', { ascending: false })

  if (error) throw error
  return (data ?? []) as AnnouncementRow[]
}

export async function createAnnouncement(input: {
  title: string
  message: string
  published: boolean
  created_by: string
}): Promise<Announcement> {
  const { data, error } = await supabase.from('announcements').insert(input).select().single()
  if (error) throw error
  return data
}

export async function updateAnnouncement(
  id: string,
  patch: { title?: string; message?: string; published?: boolean },
): Promise<Announcement> {
  const { data, error } = await supabase
    .from('announcements')
    .update(patch)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAnnouncement(id: string): Promise<void> {
  const { error } = await supabase.from('announcements').delete().eq('id', id)
  if (error) throw error
}

// ---------------------------------------------------------------------------
// Audit log
// ---------------------------------------------------------------------------
export type AuditLog = Database['public']['Tables']['audit_logs']['Row']

export interface AuditLogRow extends AuditLog {
  actor: { id: string; name: string; profile_photo: string | null } | null
}

export interface AuditFilters {
  module?: string | 'all'
  action?: Database['public']['Enums']['audit_action'] | 'all'
  userId?: string | 'all'
  from?: string
  to?: string
  limit?: number
}

/**
 * Super-admin only, enforced by RLS. There is deliberately no update or delete
 * path anywhere in the app or the database — a trail that can be edited is not
 * evidence of anything.
 */
export async function listAuditLogs(filters: AuditFilters = {}): Promise<AuditLogRow[]> {
  let query = supabase
    .from('audit_logs')
    .select('*, actor:user_id(id, name, profile_photo)')
    .order('created_at', { ascending: false })
    .limit(filters.limit ?? 200)

  if (filters.module && filters.module !== 'all') query = query.eq('module', filters.module)
  if (filters.action && filters.action !== 'all') query = query.eq('action', filters.action)
  if (filters.userId && filters.userId !== 'all') query = query.eq('user_id', filters.userId)
  if (filters.from) query = query.gte('created_at', `${filters.from}T00:00:00Z`)
  if (filters.to) query = query.lte('created_at', `${filters.to}T23:59:59Z`)

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as AuditLogRow[]
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------
export type AppSettings = Database['public']['Tables']['app_settings']['Row']

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase.from('app_settings').select('*').single()
  if (error) throw error
  return data
}

export type SettingsUpdate = Pick<
  Database['public']['Tables']['app_settings']['Update'],
  | 'work_day_start'
  | 'work_day_end'
  | 'standard_hours'
  | 'late_grace_minutes'
  | 'half_day_max_hours'
  | 'timezone'
  | 'auto_punch_out_after'
>

export async function updateSettings(patch: SettingsUpdate, userId: string): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .update({ ...patch, updated_by: userId })
    // The singleton primary key is the literal true.
    .eq('id', true)
    .select()
    .single()

  if (error) throw error
  return data
}
