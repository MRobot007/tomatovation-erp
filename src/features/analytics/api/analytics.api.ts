import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type Fns = Database['public']['Functions']

export type AttendanceSummary = Fns['analytics_attendance_summary']['Returns'][number]
export type EmployeePerformance = Fns['analytics_employee_performance']['Returns'][number]
export type LeadFunnelRow = Fns['analytics_lead_funnel']['Returns'][number]
export type DailyLeadsRow = Fns['analytics_daily_leads']['Returns'][number]
export type LeaveStatsRow = Fns['analytics_leave_stats']['Returns'][number]
export type DashboardStats = Fns['analytics_dashboard_stats']['Returns'][number]

/**
 * Every function here is a thin call to a Postgres aggregate. No reduction
 * happens in this file on purpose — the spec forbids fetching raw rows and
 * summing them in the browser, and at 500 employees that would mean shipping
 * six figures of rows to compute an average.
 */

export async function getAttendanceSummary(from: string, to: string): Promise<AttendanceSummary[]> {
  const { data, error } = await supabase.rpc('analytics_attendance_summary', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return data ?? []
}

export async function getEmployeePerformance(
  from: string,
  to: string,
): Promise<EmployeePerformance[]> {
  const { data, error } = await supabase.rpc('analytics_employee_performance', {
    p_from: from,
    p_to: to,
  })
  if (error) throw error
  return data ?? []
}

export async function getLeadFunnel(from?: string, to?: string): Promise<LeadFunnelRow[]> {
  const { data, error } = await supabase.rpc('analytics_lead_funnel', {
    p_from: from ?? undefined,
    p_to: to ?? undefined,
  })
  if (error) throw error
  return data ?? []
}

export async function getDailyLeads(from: string, to: string): Promise<DailyLeadsRow[]> {
  const { data, error } = await supabase.rpc('analytics_daily_leads', { p_from: from, p_to: to })
  if (error) throw error
  return data ?? []
}

export async function getLeaveStats(from: string, to: string): Promise<LeaveStatsRow[]> {
  const { data, error } = await supabase.rpc('analytics_leave_stats', { p_from: from, p_to: to })
  if (error) throw error
  return data ?? []
}

export async function getDashboardStats(date: string): Promise<DashboardStats | null> {
  const { data, error } = await supabase.rpc('analytics_dashboard_stats', { p_date: date })
  if (error) throw error
  return data?.[0] ?? null
}
