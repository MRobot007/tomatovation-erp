import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyAttendanceToday,
  getTodayDate,
  listMyAttendance,
  listTeamAttendance,
  punchIn,
  punchOut,
  toggleBreak,
  type TeamAttendanceFilters,
} from '../api/attendance.api'
import { detectClientContext, requestCoordinates } from '../lib/client-context'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  all: ['attendance'] as const,
  today: (userId: string, date: string) => ['attendance', 'today', userId, date] as const,
  mine: (userId: string) => ['attendance', 'mine', userId] as const,
  team: (filters: TeamAttendanceFilters) => ['attendance', 'team', filters] as const,
  date: ['attendance', 'today-date'] as const,
}

/** The organisation's current date, from app_settings.timezone. */
export function useTodayDate() {
  return useQuery({
    queryKey: keys.date,
    queryFn: getTodayDate,
    // Refetched on focus so a tab left open overnight rolls to the new day
    // rather than writing to yesterday.
    staleTime: 5 * 60_000,
  })
}

export function useMyAttendanceToday() {
  const { user } = useAuth()
  const { data: date } = useTodayDate()

  return useQuery({
    queryKey: keys.today(user?.id ?? '', date ?? ''),
    queryFn: () => getMyAttendanceToday(user!.id, date!),
    enabled: Boolean(user?.id && date),
  })
}

export function useMyAttendanceHistory(limit = 30) {
  const { user } = useAuth()

  return useQuery({
    queryKey: [...keys.mine(user?.id ?? ''), limit],
    queryFn: () => listMyAttendance(user!.id, limit),
    enabled: Boolean(user?.id),
  })
}

export function useTeamAttendance(filters: TeamAttendanceFilters) {
  return useQuery({
    queryKey: keys.team(filters),
    queryFn: () => listTeamAttendance(filters),
    enabled: Boolean(filters.date),
    placeholderData: (previous) => previous,
  })
}

/**
 * Punch actions share one invalidation: any of them changes today's row, the
 * personal history, and the team board a manager may have open.
 */
export function usePunchActions() {
  const queryClient = useQueryClient()
  const invalidate = () => void queryClient.invalidateQueries({ queryKey: keys.all })

  const inMutation = useMutation({
    mutationFn: async () => {
      const context = detectClientContext()
      // Location is requested but never awaited past its own timeout, and a
      // refusal resolves to null — clocking in must not depend on it.
      const coords = await requestCoordinates()
      return punchIn({ ...context, lat: coords?.lat, lng: coords?.lng })
    },
    onSuccess: invalidate,
  })

  const outMutation = useMutation({
    mutationFn: async () => {
      const coords = await requestCoordinates()
      return punchOut({ lat: coords?.lat, lng: coords?.lng })
    },
    onSuccess: invalidate,
  })

  const breakMutation = useMutation({ mutationFn: toggleBreak, onSuccess: invalidate })

  return { punchIn: inMutation, punchOut: outMutation, toggleBreak: breakMutation }
}

/**
 * Ticking elapsed time since a start instant, excluding break minutes already
 * banked. Recomputed from the timestamp each second rather than incremented, so
 * a backgrounded tab (where timers are throttled) shows the right number the
 * moment it returns to the foreground.
 */
/**
 * Seconds worked so far, ticking once a second.
 *
 * Recomputed from the clock on every tick rather than incremented, so a laptop
 * coming back from sleep is immediately right instead of however far behind
 * the interval fell while it was suspended.
 *
 * Returns 0 rather than null when not running, so callers can do arithmetic on
 * it without a guard at every use.
 */
export function useElapsedSeconds(since: string | null | undefined, bankedMinutes = 0): number {
  const [, forceTick] = useState(0)

  useEffect(() => {
    if (!since) return
    const timer = window.setInterval(() => forceTick((n) => n + 1), 1000)
    return () => window.clearInterval(timer)
  }, [since])

  if (!since) return 0

  return Math.max(
    0,
    Math.floor((Date.now() - new Date(since).getTime()) / 1000) - bankedMinutes * 60,
  )
}

export function useElapsed(since: string | null | undefined, bankedMinutes = 0): string {
  const totalSeconds = useElapsedSeconds(since, bankedMinutes)

  if (!since) return '—'

  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
