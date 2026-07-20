import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Notification = Database['public']['Tables']['notifications']['Row']
export type NotificationType = Database['public']['Enums']['notification_type']

export async function listNotifications(limit = 50): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export async function countUnread(): Promise<number> {
  // head:true fetches the count without the rows — this runs on every realtime
  // event, so the payload matters.
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('read', false)

  if (error) throw error
  return count ?? 0
}

/**
 * Only the read flag can be changed — guard_notification_update rejects any
 * other field, so this cannot be widened by accident later.
 */
export async function markAsRead(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id)
  if (error) throw error
}

export async function markAllAsRead(): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false)
  if (error) throw error
}

export async function deleteNotification(id: string): Promise<void> {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
}
