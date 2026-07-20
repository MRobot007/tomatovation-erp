import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Radio } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { PresenceDot, PRESENCE_LABELS, type PresenceStatus } from '@/components/presence-dot'
import { useTeamAttendance, useTodayDate } from '@/features/attendance/hooks/use-attendance'
import type { AttendanceRow } from '@/features/attendance/api/attendance.api'
import { supabase } from '@/lib/supabase'
import { formatHours } from '@/lib/utils'

/**
 * Presence is derived from the attendance row, not tracked separately. A
 * websocket "online" flag would say someone has a tab open; this says they are
 * actually clocked in, which is the question a manager is asking.
 */
function presenceOf(row: AttendanceRow): PresenceStatus {
  if (row.break_started_at) return 'break'
  if (row.punch_in && !row.punch_out) return 'working'
  if (row.punch_out) return 'offline'
  return 'offline'
}

function time(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function LiveBoardPage() {
  const queryClient = useQueryClient()
  const { data: todayDate } = useTodayDate()
  const { data, isLoading, error, refetch } = useTeamAttendance({ date: todayDate ?? '' })

  // Attendance is in the realtime publication, so the board reflects a punch
  // within a second rather than on the next poll.
  useEffect(() => {
    const channel = supabase
      .channel('live-attendance-board')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['attendance'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const groups: Array<[PresenceStatus, AttendanceRow[]]> = [
    ['working', data?.filter((row) => presenceOf(row) === 'working') ?? []],
    ['break', data?.filter((row) => presenceOf(row) === 'break') ?? []],
    ['offline', data?.filter((row) => presenceOf(row) === 'offline') ?? []],
  ]

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Live board"
        description="Who is clocked in right now. Updates the moment someone punches, without a refresh."
        actions={
          <Badge tone="success" dot>
            Live
          </Badge>
        }
      />

      {error && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <CardContent className="space-y-3 pt-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {data && data.length === 0 && (
        <Card>
          <EmptyState
            icon={Radio}
            title="Nobody has punched in today"
            description="This board fills in as your team starts their day."
          />
        </Card>
      )}

      {data && data.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-3">
          {groups.map(([status, rows]) => (
            <section key={status}>
              <div className="mb-2 flex items-center gap-2">
                <PresenceDot status={status} />
                <h3 className="eyebrow">{PRESENCE_LABELS[status]}</h3>
                <span className="font-mono text-xs text-ink-subtle" data-numeric>
                  {rows.length}
                </span>
              </div>

              <div className="space-y-2">
                {rows.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-line px-3 py-5 text-center text-xs text-ink-subtle">
                    Nobody
                  </p>
                ) : (
                  rows.map((row) => (
                    <Card key={row.id}>
                      <CardContent className="flex items-center gap-3 py-3">
                        <div className="relative">
                          <UserAvatar
                            name={row.employee?.name}
                            src={row.employee?.profile_photo}
                            size="md"
                          />
                          <PresenceDot
                            status={presenceOf(row)}
                            className="absolute -bottom-0.5 -right-0.5 ring-2 ring-surface"
                          />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-ink">
                            {row.employee?.name ?? 'Unknown'}
                          </p>
                          <p className="truncate text-xs text-ink-subtle">
                            {row.employee?.department ?? 'No department'}
                          </p>
                        </div>

                        <div className="shrink-0 text-right">
                          <p className="font-mono text-sm text-ink" data-numeric>
                            {row.punch_out ? formatHours(row.working_hours) : time(row.punch_in)}
                          </p>
                          {(row.late_minutes ?? 0) > 0 && (
                            <p className="font-mono text-2xs text-warning" data-numeric>
                              +{row.late_minutes}m late
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
