import { Coffee, LogIn, LogOut, MapPin, MonitorSmartphone, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SessionList } from './session-list'
import { FormError } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import { useElapsedSeconds, useMyAttendanceToday, usePunchActions } from '../hooks/use-attendance'
import { useSettings } from '@/features/admin/hooks/use-admin'
import type { Attendance } from '../api/attendance.api'
import { cn, formatHours } from '@/lib/utils'

function formatTime(value: string | null): string {
  if (!value) return '--'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** Seconds as H:MM:SS, the running-clock format. */
export function formatClock(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

/**
 * Time worked on a day whose clock is not currently ticking — paused for a
 * break, or already finished.
 *
 * Break time is subtracted in both branches: the row's break_minutes is what
 * the punch RPCs bank, and counting a lunch hour as worked would put the
 * number on the dial at odds with the one payroll sees.
 */
export function frozenSeconds(today: Attendance | null | undefined): number {
  if (!today?.punch_in) return 0

  if (today.punch_out) return Math.round((today.working_hours ?? 0) * 3600)

  if (today.break_started_at) {
    const upToBreak =
      (new Date(today.break_started_at).getTime() - new Date(today.punch_in).getTime()) / 1000
    return Math.max(0, Math.floor(upToBreak) - (today.break_minutes ?? 0) * 60)
  }

  return 0
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
  const { data: settings } = useSettings()

  // Called before the early return and unconditionally: hooks cannot sit
  // behind a branch, and deriveState is a plain function, not a component.
  const running =
    today?.punch_in && !today.punch_out && !today.break_started_at ? today.punch_in : null

  const liveSeconds = useElapsedSeconds(running, today?.break_minutes ?? 0)

  // The clock only ticks while actually working, so a paused or finished day
  // needs its total computed rather than read from the live counter — which is
  // zero the moment `running` goes null. Without this the dial reads "0:00:00"
  // the instant someone takes a break, as if the morning had not happened.
  const workedSeconds = running ? liveSeconds : frozenSeconds(today)

  // The ring fills across a standard day, from settings rather than a constant
  // — an office on a 7-hour day should not see a permanently under-filled dial.
  const standardHours = settings?.standard_hours ?? 8
  const progress = Math.min(1, workedSeconds / Math.max(1, standardHours * 3600))
  const elapsed = today?.punch_in ? formatClock(workedSeconds) : '—'

  if (isLoading) return <PunchCardSkeleton />

  const state = deriveState(today)
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
          <Dial
            state={state}
            elapsed={elapsed}
            progress={progress}
            busy={busy}
            onToggle={() => {
              // The circle is the whole control: it punches in when off, and
              // punches out when on. Tapping while on break ends the day too,
              // which the punch_out RPC handles by banking the open break.
              if (state.key === 'working' || state.key === 'on_break') {
                actions.punchOut.mutate()
              } else {
                actions.punchIn.mutate()
              }
            }}
          />
          <p className="mt-3 font-display text-lg font-semibold leading-tight tracking-tight text-ink">
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

      {/* Punch in and out now live in the dial itself, so the only action left
          down here is the break — a secondary thing that would be wrong to give
          the same weight as the tap target above. Not started has nothing to
          show, so the row is dropped entirely rather than left as a gap. */}
      {state.key !== 'not_started' && (
        <div className="mt-5 flex flex-col gap-2">
          {(state.key === 'working' || state.key === 'on_break') && (
            <Button
              variant="outline"
              size="lg"
              className="w-full"
              loading={actions.toggleBreak.isPending}
              disabled={busy}
              onClick={() => actions.toggleBreak.mutate()}
            >
              <Coffee aria-hidden />
              {state.key === 'on_break' ? 'End break' : 'Take a break'}
            </Button>
          )}

          {state.key === 'completed' && (
            <p className="w-full rounded-lg border border-success/25 bg-success-soft px-4 py-3 text-center text-sm font-medium text-success">
              {formatHours(today?.working_hours)} recorded — tap the dial to start another shift
            </p>
          )}
        </div>
      )}

      <SessionList attendanceId={today?.id} />

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

/** r=45 in a 100-unit viewBox, so the ring's full length is 2·pi·45. */
const RING_LENGTH = 2 * Math.PI * 45

/**
 * The dial IS the control. Tap it to punch in, and it starts counting; tap it
 * again to punch out.
 *
 * It was punch-in-only before, with a separate button to punch out, on the
 * grounds that punching out was irreversible and should not sit under the same
 * careless tap that started the day. That reasoning went away with the
 * multiple-sessions change: a day can be reopened by punching in again, so a
 * mistaken tap costs one more tap to undo, not a lost afternoon. A single
 * toggle is simpler and is what was asked for.
 */
function Dial({
  state,
  elapsed,
  progress,
  busy,
  onToggle,
}: {
  state: DerivedState
  elapsed: string
  progress: number
  busy: boolean
  onToggle: () => void
}) {
  const running = state.key === 'working' || state.key === 'on_break'

  const ringClass =
    state.key === 'on_break'
      ? 'text-warning'
      : state.key === 'not_started'
        ? 'text-danger'
        : 'text-success'

  const caption = running ? 'Tap to punch out' : 'Tap to punch in'
  const CaptionIcon = running ? LogOut : LogIn

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-label={running ? 'Punch out and stop the clock' : 'Punch in and start the clock'}
      className={cn(
        'group relative flex size-36 items-center justify-center rounded-full',
        'cursor-pointer transition-[background-color,transform] duration-300 ease-out-expo',
        'active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        state.key === 'working' && 'bg-success-soft',
        state.key === 'on_break' && 'bg-warning-soft',
        state.key === 'completed' && 'bg-success-soft',
        state.key === 'not_started' && 'bg-elevated hover:bg-elevated/70',
      )}
    >
      {/* -rotate-90 so the ring fills from twelve o'clock. An SVG arc starts at
          three o'clock, which reads as starting the day an hour and a half in. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="5" className="stroke-line" />
        {running && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="5"
            strokeLinecap="round"
            className={cn('stroke-current transition-[stroke-dashoffset] duration-1000 ease-linear', ringClass)}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        )}
      </svg>

      <span className="relative flex flex-col items-center gap-1.5">
        {running ? (
          <span className="font-mono text-2xl font-semibold tracking-tight text-ink" data-numeric>
            {elapsed}
          </span>
        ) : (
          <state.icon className={cn('size-8', ringClass)} aria-hidden />
        )}
        <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
          <CaptionIcon className="size-3" aria-hidden />
          {caption}
        </span>
      </span>

      {/* A ring that widens on hover, so the circle reads as pressable before
          the cursor is on it. Tinted by the action: red-ish to punch out,
          green-ish to punch in. */}
      <span
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full ring-2 ring-transparent transition-all duration-200',
          'group-hover:ring-offset-2 group-hover:ring-offset-surface',
          running ? 'group-hover:ring-danger/25' : 'group-hover:ring-success/25',
        )}
        aria-hidden
      />
    </button>
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
function deriveState(today: Attendance | null | undefined): DerivedState {
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
      headline: 'On break',
      // The dial holds the count, so the line under it says what the count is
      // doing rather than repeating the figure a centimetre above it.
      detail: `Paused at ${formatTime(today.break_started_at)} — the clock is stopped.`,
      icon: Coffee,
    }
  }

  return {
    key: 'working',
    pill: 'Working',
    headline: 'Working now',
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
