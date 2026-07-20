import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

export type Attendance = Database['public']['Tables']['attendance']['Row']
export type AttendanceStatus = Database['public']['Enums']['attendance_status']

export interface AttendanceRow extends Attendance {
  employee: { id: string; name: string; profile_photo: string | null; department: string | null } | null
}

/**
 * The organisation's working day, not the browser's. Attendance is keyed by a
 * date in the configured timezone, so a punch at 00:30 IST from a laptop set to
 * UTC must still land on the correct local day.
 */
export async function getTodayDate(): Promise<string> {
  const { data, error } = await supabase.from('app_settings').select('timezone').single()
  if (error) throw error

  return new Intl.DateTimeFormat('en-CA', {
    timeZone: data.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
}

export async function getMyAttendanceToday(userId: string, date: string): Promise<Attendance | null> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', userId)
    .eq('date', date)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function listMyAttendance(userId: string, limit = 30): Promise<Attendance[]> {
  const { data, error } = await supabase
    .from('attendance')
    .select('*')
    .eq('employee_id', userId)
    .order('date', { ascending: false })
    .limit(limit)

  if (error) throw error
  return data ?? []
}

export interface TeamAttendanceFilters {
  date: string
  status?: AttendanceStatus | 'all'
  search?: string
}

/**
 * RLS scopes this automatically: a manager receives their direct reports, a
 * super admin receives everyone. The query carries no role logic of its own.
 */
export async function listTeamAttendance(filters: TeamAttendanceFilters): Promise<AttendanceRow[]> {
  let query = supabase
    .from('attendance')
    .select('*, employee:employee_id(id, name, profile_photo, department)')
    .eq('date', filters.date)
    .order('punch_in', { ascending: true, nullsFirst: false })

  if (filters.status && filters.status !== 'all') query = query.eq('status', filters.status)

  const { data, error } = await query
  if (error) throw error

  const rows = (data ?? []) as AttendanceRow[]
  if (!filters.search?.trim()) return rows

  // Filtered client-side: the search targets the joined profile, and PostgREST
  // cannot filter on an embedded resource without turning it into an inner
  // join that would drop rows with no matching employee.
  const term = filters.search.trim().toLowerCase()
  return rows.filter((row) => row.employee?.name.toLowerCase().includes(term))
}

// ---------------------------------------------------------------------------
// Punch actions
// ---------------------------------------------------------------------------

export interface PunchContext {
  lat?: number | null
  lng?: number | null
  device?: string
  browser?: string
}

/**
 * All three go through RPCs, never a table write. Timestamps come from the
 * database clock and the derived fields from a trigger, so a client with a
 * wrong or deliberately altered clock cannot forge a working day.
 */
export async function punchIn(context: PunchContext = {}): Promise<Attendance> {
  const { data, error } = await supabase.rpc('punch_in', {
    p_lat: context.lat ?? undefined,
    p_lng: context.lng ?? undefined,
    p_device: context.device,
    p_browser: context.browser,
  })

  if (error) throw error
  return data as unknown as Attendance
}

export async function punchOut(context: PunchContext = {}): Promise<Attendance> {
  const { data, error } = await supabase.rpc('punch_out', {
    p_lat: context.lat ?? undefined,
    p_lng: context.lng ?? undefined,
  })

  if (error) throw error
  return data as unknown as Attendance
}

export async function toggleBreak(): Promise<Attendance> {
  const { data, error } = await supabase.rpc('toggle_break')
  if (error) throw error
  return data as unknown as Attendance
}
