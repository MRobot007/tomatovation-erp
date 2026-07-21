import { Coffee, LogIn, LogOut, MapPin, MonitorSmartphone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FormError } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useElapsed, useMyAttendanceToday, usePunchActions } from '../hooks/use-attendance'
import type { Attendance } from '../api/attendance.api'
import { cn, formatHours } from '@/lib/utils'

function formatTime(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * The hero of the attendance screen: one primary action whose meaning is
 * derived from today's row, never from local state. Someone who punched in on
 * their phone sees "Punch out" here without a refresh.
 */
export function PunchCard() {
  const { data: today, isLoading } = useMyAttendanceToday()
  const actions = usePunchActions()

  // Called before the early return and unconditionally: hooks cannot sit behind
  // a branch, and deriveState is a plain function, not a component.
  const elapsed = useElapsed(
    today?.punch_in && !today.punch_out && !today.break_started_at ? today.punch_in : null,
    today?.break_minutes ?? 0,
  )

  if (isLoading) return <PunchCardSkeleton />

  const state = deriveState(today, elapsed)
  const error = actions.punchIn.error ?? actions.punchOut.error ?? actions.toggleBreak.error
  const busy =
    actions.punchIn.isPending || actions.punchOut.isPending || actions.toggleBreak.isPending

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface shadow-sm">
      <div
        className={cn(
          'relative px-5 py-6 transition-colors duration-300',
          state.key === 'working' && 'bg-brand-soft',
          state.key === 'on_break' && 'bg-warning-soft',
          state.key === 'completed' && 'bg-success-soft',
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="eyebrow mb-1.5">{state.eyebrow}</p>
            <p className="font-display text-3xl font-semibold leading-none tracking-tight text-ink">
              {state.headline}
            </p>
            <p className="mt-2 text-sm text-ink-muted">{state.detail}</p>
          </div>

          <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
            {state.key === 'not_started' && (
              <Button
                variant="primary"
                size="lg"
                loading={actions.punchIn.isPending}
                disabled={busy}
                onClick={() => actions.punchIn.mutate()}
              >
                <LogIn aria-hidden />
                Punch in
              </Button>
            )}

            {(state.key === 'working' || state.key === 'on_break') && (
              <>
                <Button
                  variant={state.key === 'on_break' ? 'primary' : 'outline'}
                  size="lg"
                  loading={actions.toggleBreak.isPending}
                  disabled={busy}
                  onClick={() => actions.toggleBreak.mutate()}
                >
                  <Coffee aria-hidden />
                  {state.key === 'on_break' ? 'End break' : 'Take a break'}
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  loading={actions.punchOut.isPending}
                  disabled={busy}
                  onClick={() => actions.punchOut.mutate()}
                >
                  <LogOut aria-hidden />
                  Punch out
                </Button>
              </>
            )}

            {state.key === 'completed' && (
              <Badge tone="success" dot className="self-start px-2 py-1 text-xs">
                Day complete
              </Badge>
            )}
          </div>
        </div>

        {error != null && (
          <div className="mt-4">
            <FormError error={error} />
          </div>
        )}
      </div>

      {today && (
        <div className="grid grid-cols-2 divide-x divide-line border-t border-line sm:grid-cols-4">
          <Stat label="Punched in" value={formatTime(today.punch_in)} />
          <Stat label="Punched out" value={formatTime(today.punch_out)} />
          <Stat label="Break" value={today.break_minutes > 0 ? `${today.break_minutes}m` : '—'} />
          <Stat
            label={today.punch_out ? 'Worked' : 'Late by'}
            value={
              today.punch_out
                ? formatHours(today.working_hours)
                : today.late_minutes
                  ? `${today.late_minutes}m`
                  : 'On time'
            }
            tone={!today.punch_out && today.late_minutes ? 'warning' : undefined}
          />
        </div>
      )}

      {today && (today.device || today.punch_in_lat != null) && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line bg-elevated/40 px-5 py-2 text-xs text-ink-subtle">
          {today.device && (
            <span className="flex items-center gap-1.5">
              <MonitorSmartphone className="size-3" aria-hidden />
              {today.device} · {today.browser}
            </span>
          )}
          {today.punch_in_lat != null && today.punch_in_lng != null && (
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3" aria-hidden />
              {today.punch_in_lat.toFixed(4)}, {today.punch_in_lng.toFixed(4)}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'warning'
}) {
  return (
    <div className="px-5 py-3">
      <p className="eyebrow mb-1">{label}</p>
      <p
        className={cn('font-mono text-md font-medium', tone === 'warning' ? 'text-warning' : 'text-ink')}
        data-numeric
      >
        {value}
      </p>
    </div>
  )
}

interface DerivedState {
  key: 'not_started' | 'working' | 'on_break' | 'completed'
  eyebrow: string
  headline: string
  detail: string
}

/**
 * Derived from the row, not stored. The status column and the timestamps can
 * only disagree if something wrote them directly, and the timestamps are the
 * ones payroll cares about.
 */
function deriveState(today: Attendance | null | undefined, elapsed: string): DerivedState {
  if (!today?.punch_in) {
    return {
      key: 'not_started',
      eyebrow: 'Today',
      headline: 'Not started',
      detail: 'Punch in to start recording your day.',
    }
  }

  if (today.punch_out) {
    return {
      key: 'completed',
      eyebrow: 'Today',
      headline: formatHours(today.working_hours),
      detail: `${formatTime(today.punch_in)} to ${formatTime(today.punch_out)}${
        today.overtime_hours ? ` · ${formatHours(today.overtime_hours)} overtime` : ''
      }`,
    }
  }

  if (today.break_started_at) {
    return {
      key: 'on_break',
      eyebrow: 'On break since',
      headline: formatTime(today.break_started_at),
      detail: 'Your break time is deducted from the day automatically.',
    }
  }

  return {
    key: 'working',
    eyebrow: 'Working for',
    headline: elapsed,
    detail: `Since ${formatTime(today.punch_in)}`,
  }
}

function PunchCardSkeleton() {
  return (
    <div className="rounded-lg border border-line bg-surface p-5 shadow-sm">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="mt-3 h-8 w-40" />
      <Skeleton className="mt-3 h-3 w-56" />
    </div>
  )
}
