import { Coffee, LogIn, LogOut, MapPin, MonitorSmartphone, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormError } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useElapsed, useMyAttendanceToday, usePunchActions } from '../hooks/use-attendance'
import type { Attendance } from '../api/attendance.api'
import { cn, formatHours } from '@/lib/utils'

function formatTime(value: string | null): string {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/**
 * The hero of the day: one primary action whose meaning is derived from
 * today's row, never from local state. Someone who punched in on their phone
 * sees "Punch out" here without a refresh.
 *
 * Two halves side by side — the ledger on the left, the state of the day on
 * the right. The ledger is four facts in a fixed order, so the eye learns
 * where "when did I get in" lives and stops reading labels; the dial carries
 * the one thing that changes.
 */
export function PunchCard() {
  const { data: today, isLoading } = useMyAttendanceToday()
  const actions = usePunchActions()

  // Called before the early return and unconditionally: hooks cannot sit
  // behind a branch, and deriveState is a plain function, not a component.
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
    <Card className="flex h-full flex-col p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="eyebrow">Today&rsquo;s attendance</p>
        <StatusPill state={state} />
      </div>

      <div className="grid flex-1 gap-5 sm:grid-cols-[1fr_auto_0.8fr] sm:items-center">
        <div className="divide-y divide-line overflow-hidden rounded-lg border border-line">
          <LedgerRow
            icon={LogIn}
            tone="success"
            label="Punch In Time"
            value={formatTime(today?.punch_in ?? null)}
          />
          <LedgerRow
            icon={LogOut}
            tone="danger"
            label="Punch Out Time"
            value={formatTime(today?.punch_out ?? null)}
          />
          <LedgerRow
            icon={Timer}
            tone="info"
            label="Working Hours"
            value={
              today?.punch_out
                ? formatHours(today.working_hours)
                : today?.punch_in
                  ? elapsed
                  : '0h 00m'
            }
          />
          <LedgerRow
            icon={Coffee}
            tone="warning"
            label="Break Time"
            value={today?.break_minutes ? `${today.break_minutes}m` : '0m'}
          />
        </div>

        {/* Only on wide layouts: once stacked, a vertical rule is a line with
            nothing on either side of it. */}
        <div className="hidden w-px self-stretch bg-line sm:block" aria-hidden />

        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <div
            className={cn(
              'mb-2 flex size-28 items-center justify-center rounded-full transition-colors duration-500',
              state.key === 'working' && 'bg-success-soft',
              state.key === 'on_break' && 'bg-warning-soft',
              state.key === 'completed' && 'bg-success-soft',
              state.key === 'not_started' && 'bg-elevated',
            )}
          >
            <state.icon
              className={cn(
                'size-9',
                state.key === 'working' && 'text-success',
                state.key === 'on_break' && 'text-warning',
                state.key === 'completed' && 'text-success',
                state.key === 'not_started' && 'text-danger',
              )}
              aria-hidden
            />
          </div>
          <p className="font-display text-lg font-semibold leading-tight tracking-tight text-ink">
            {state.headline}
          </p>
          <p className="max-w-[16rem] text-sm text-ink-muted">{state.detail}</p>
        </div>
      </div>

      {error != null && (
        <div className="mt-4">
          <FormError error={error} />
        </div>
      )}

      {/* The action spans the card. This is the one thing most people open the
          app to do, and a full-width target says so without a label having to
          explain that it is the primary. */}
      <div className="mt-5 flex flex-col gap-2 sm:flex-row">
        {state.key === 'not_started' && (
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            loading={actions.punchIn.isPending}
            disabled={busy}
            onClick={() => actions.punchIn.mutate()}
          >
            <LogIn aria-hidden />
            Punch In
          </Button>
        )}

        {(state.key === 'working' || state.key === 'on_break') && (
          <>
            <Button
              variant="outline"
              size="lg"
              className="w-full sm:w-auto"
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
              className="w-full flex-1"
              loading={actions.punchOut.isPending}
              disabled={busy}
              onClick={() => actions.punchOut.mutate()}
            >
              <LogOut aria-hidden />
              Punch Out
            </Button>
          </>
        )}

        {state.key === 'completed' && (
          <p className="w-full rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-center text-sm font-medium text-success">
            Day complete — {formatHours(today?.working_hours)} recorded
          </p>
        )}
      </div>

      {today && (today.device || today.punch_in_lat != null) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-subtle">
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
    </Card>
  )
}

const TONE_CLASS = {
  success: 'bg-success-soft text-success',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
  warning: 'bg-warning-soft text-warning',
} as const

/**
 * One fact, one row. The icon is tinted by meaning rather than for decoration —
 * arriving is green, leaving is red — so a row is identifiable before its
 * label is read.
 */
function LedgerRow({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof LogIn
  tone: keyof typeof TONE_CLASS
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <span
        className={cn(
          'flex size-7 shrink-0 items-center justify-center rounded-md',
          TONE_CLASS[tone],
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{label}</span>
      <span className="shrink-0 font-mono text-sm font-medium text-ink" data-numeric>
        {value}
      </span>
    </div>
  )
}

function StatusPill({ state }: { state: DerivedState }) {
  const tone =
    state.key === 'working' || state.key === 'completed'
      ? 'border-success/25 bg-success-soft text-success'
      : state.key === 'on_break'
        ? 'border-warning/25 bg-warning-soft text-warning'
        : 'border-danger/25 bg-danger-soft text-danger'

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
        tone,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {state.pill}
    </span>
  )
}

interface DerivedState {
  key: 'not_started' | 'working' | 'on_break' | 'completed'
  pill: string
  headline: string
  detail: string
  icon: typeof Timer
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
      pill: 'Not Started',
      headline: 'Day not started',
      detail: 'Punch in to start your day.',
      icon: Timer,
    }
  }

  if (today.punch_out) {
    return {
      key: 'completed',
      pill: 'Complete',
      headline: formatHours(today.working_hours),
      detail: `${formatTime(today.punch_in)} to ${formatTime(today.punch_out)}${
        today.overtime_hours ? ` · ${formatHours(today.overtime_hours)} overtime` : ''
      }`,
      icon: LogOut,
    }
  }

  if (today.break_started_at) {
    return {
      key: 'on_break',
      pill: 'On Break',
      headline: `Since ${formatTime(today.break_started_at)}`,
      detail: 'Break time is deducted from the day automatically.',
      icon: Coffee,
    }
  }

  return {
    key: 'working',
    pill: 'Working',
    headline: elapsed,
    detail: `Since ${formatTime(today.punch_in)}`,
    icon: Timer,
  }
}

function PunchCardSkeleton() {
  return (
    <Card className="h-full p-5">
      <Skeleton className="h-3 w-28" />
      <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_0.8fr]">
        <Skeleton className="h-[13.5rem] w-full" />
        <Skeleton className="h-[13.5rem] w-full" />
      </div>
      <Skeleton className="mt-5 h-11 w-full" />
    </Card>
  )
}
