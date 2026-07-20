import { useQuery } from '@tanstack/react-query'
import {
  getAttendanceSummary,
  getDailyLeads,
  getDashboardStats,
  getEmployeePerformance,
  getLeadFunnel,
  getLeaveStats,
} from '../api/analytics.api'

const keys = {
  attendance: (from: string, to: string) => ['analytics', 'attendance', from, to] as const,
  performance: (from: string, to: string) => ['analytics', 'performance', from, to] as const,
  funnel: (from: string, to: string) => ['analytics', 'funnel', from, to] as const,
  dailyLeads: (from: string, to: string) => ['analytics', 'daily-leads', from, to] as const,
  leaveStats: (from: string, to: string) => ['analytics', 'leave-stats', from, to] as const,
  dashboard: (date: string) => ['analytics', 'dashboard', date] as const,
}

/** Aggregates change slowly; a longer stale window avoids refetching charts. */
const ANALYTICS_STALE = 2 * 60_000

export function useAttendanceSummary(from: string, to: string) {
  return useQuery({
    queryKey: keys.attendance(from, to),
    queryFn: () => getAttendanceSummary(from, to),
    enabled: Boolean(from && to),
    staleTime: ANALYTICS_STALE,
  })
}

export function useEmployeePerformance(from: string, to: string) {
  return useQuery({
    queryKey: keys.performance(from, to),
    queryFn: () => getEmployeePerformance(from, to),
    enabled: Boolean(from && to),
    staleTime: ANALYTICS_STALE,
  })
}

export function useLeadFunnel(from: string, to: string) {
  return useQuery({
    queryKey: keys.funnel(from, to),
    queryFn: () => getLeadFunnel(from, to),
    enabled: Boolean(from && to),
    staleTime: ANALYTICS_STALE,
  })
}

export function useDailyLeads(from: string, to: string) {
  return useQuery({
    queryKey: keys.dailyLeads(from, to),
    queryFn: () => getDailyLeads(from, to),
    enabled: Boolean(from && to),
    staleTime: ANALYTICS_STALE,
  })
}

export function useLeaveStats(from: string, to: string) {
  return useQuery({
    queryKey: keys.leaveStats(from, to),
    queryFn: () => getLeaveStats(from, to),
    enabled: Boolean(from && to),
    staleTime: ANALYTICS_STALE,
  })
}

export function useDashboardStats(date: string | undefined) {
  return useQuery({
    queryKey: keys.dashboard(date ?? ''),
    queryFn: () => getDashboardStats(date as string),
    enabled: Boolean(date),
    staleTime: 60_000,
  })
}
