import { Coffee, LogIn, LogOut, MapPin, MonitorSmartphone, Timer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { FormError } from '@/components/ui/form-field'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useElapsedSeconds,
  useMyAttendanceToday,
  usePunchActions,
  useTodaySessions,
  type AttendanceSession,
} from '../hooks/use-attendance'
import { useSettings } from '@/features/admin/hooks/use-admin'
import { SessionList } from './session-list'
import type { Attendance } from '../api/attendance.api'
import { cn } from '@/lib/utils'

function formatTime(value: string | null | undefined): string {
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

/** Seconds as a coarse "56m" / "1h 5m" — for the day total, which need not tick. */
export function formatShort(totalSeconds: number): string {
  const totalMinutes = Math.round(totalSeconds / 60)
  if (totalMinutes < 60) return `${totalMinutes}m`
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`
}

/** One session's length in seconds; an open session runs to now. */
export function sessionSpanSeconds(session: AttendanceSession): number {
  const end = session.punch_out ? new Date(session.punch_out).getTime() : Date.now()
  return Math.max(0, Math.floor((end - new Date(session.punch_in).getTime()) / 1000))
}

/**
 * Whole seconds a completed day worked, from the stored total.
 *
 * working_hours is what payroll reads, so the finished-day summary agrees with
 * it rather than recomputing from timestamps and drifting by a rounding step.
 */
export function frozenSeconds(today: Attendance | null | undefined): number {
  if (!today?.punch_in || !today.punch_out) return 0
  return Math.round((today.working_hours ?? 0) * 3600)
}

/**
 * The attendance card.
 *
 * One dial, tapped to punch in and out. The number in it is the CURRENT
 * session — it starts at zero on every punch-in, so returning from a break or
 * a site visit begins a fresh count rather than adding to a total from hours
 * ago. The day's full breakdown lives in the collapsible session list below.
 */
export function PunchCard() {
  const { data: today, isLoading } = useMyAttendanceToday()
  const { data: sessions } = useTodaySessions(today?.id)
  const actions = usePunchActions()
  const { data: settings } = useSettings()

  const onBreak = Boolean(today?.break_started_at)
  const list = sessions ?? []
  const openSession = list.find((session) => session.punch_out == null) ?? null
  const lastSession = list.length > 0 ? list[list.length - 1] : null

  // The live count of the CURRENT session, from its own punch-in, from zero.
  // Paused during a break. Hooks run unconditionally, so the start is passed as
  // null when nothing is ticking rather than skipping the call.
  const liveStart = openSession && !onBreak ? openSession.punch_in : null
  const liveSeconds = useElapsedSeconds(liveStart, 0)

  const state = deriveState(today)

  // The open session's own seconds — live while working, frozen at the break.
  const openSeconds = openSession
    ? onBreak && today?.break_started_at
      ? Math.max(
          0,
          Math.floor(
            (new Date(today.break_started_at).getTime() -
              new Date(openSession.punch_in).getTime()) /
              1000,
          ),
        )
      : liveSeconds
    : 0

  // The dial shows THIS session, from zero — the open one live, or the last one
  // that closed. Never the day's total: jumping from a ten-second stint to the
  // day sum the moment you punch out is exactly what read as a bug. The total
  // lives in its own fact below.
  const shownSeconds = openSession
    ? openSeconds
    : lastSession
      ? sessionSpanSeconds(lastSession)
      : 0

  // Everything worked today: the closed sessions plus the open one's live time.
  const totalTodaySeconds =
    list.filter((s) => s.punch_out).reduce((sum, s) => sum + sessionSpanSeconds(s), 0) +
    (openSession ? openSeconds : 0)

  const standardHours = settings?.standard_hours ?? 8
  const progress = Math.min(1, shownSeconds / Math.max(1, standardHours * 3600))
  const elapsed = formatClock(shownSeconds)

  if (isLoading) return <PunchCardSkeleton />

  const error = actions.punchIn.error ?? actions.punchOut.error ?? actions.toggleBreak.error
  const busy =
    actions.punchIn.isPending || actions.punchOut.isPending || actions.toggleBreak.isPending

  const detail =
    state.key === 'working'
      ? `This shift since ${formatTime(openSession?.punch_in ?? today?.punch_in)}`
      : state.key === 'on_break'
        ? 'Clock paused — you are on a break'
        : state.key === 'completed'
          ? `Last shift ended ${formatTime(lastSession?.punch_out ?? today?.punch_out)}`
          : 'Tap the dial to start your day.'

  return (
    <Card className="flex h-full flex-col p-5 sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="eyebrow">Today&rsquo;s attendance</p>
        <StatusPill state={state} />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-2">
        <Dial
          state={state}
          elapsed={elapsed}
          progress={progress}
          busy={busy}
          onToggle={() => {
            // The circle is the whole control: punch in when off, punch out
            // when on. Tapping while on break ends the day too — punch_out
            // banks the open break.
            if (state.key === 'working' || state.key === 'on_break') {
              actions.punchOut.mutate()
            } else {
              actions.punchIn.mutate()
            }
          }}
        />
        <div className="text-center">
          <p className="font-display text-lg font-semibold leading-tight tracking-tight text-ink">
            {state.headline}
          </p>
          <p className="mt-0.5 text-sm text-ink-muted">{detail}</p>
        </div>
      </div>

      {error != null && (
        <div className="mt-4">
          <FormError error={error} />
        </div>
      )}

      {/* Three facts, quietly. The dial carries the live number; these are the
          fixed points of the day that do not move once set. */}
      {today?.punch_in && (
        <div className="mt-6 grid grid-cols-3 overflow-hidden rounded-lg border border-line">
          <Fact label="First in" value={formatTime(today.punch_in)} />
          {/* The day's total, distinct from the dial's per-session count. This
              is where "how long did I work today" is answered — the dial answers
              "how long this stint". */}
          <Fact label="Today" value={formatShort(totalTodaySeconds)} divider />
          <Fact label="Break" value={today.break_minutes ? `${today.break_minutes}m` : '0m'} divider />
        </div>
      )}

      {(state.key === 'working' || state.key === 'on_break') && (
        <Button
          variant="outline"
          size="lg"
          className="mt-3 w-full"
          loading={actions.toggleBreak.isPending}
          disabled={busy}
          onClick={() => actions.toggleBreak.mutate()}
        >
          <Coffee aria-hidden />
          {state.key === 'on_break' ? 'End break' : 'Take a break'}
        </Button>
      )}

      {state.key === 'completed' && (
        <p className="mt-3 rounded-lg border border-line bg-elevated px-4 py-3 text-center text-sm font-medium text-ink">
          Tap the dial to start another shift
        </p>
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

function Fact({ label, value, divider }: { label: string; value: string; divider?: boolean }) {
  return (
    <div className={cn('px-3 py-2.5 text-center', divider && 'border-l border-line')}>
      <p className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">{label}</p>
      <p className="mt-0.5 font-mono text-sm font-medium text-ink" data-numeric>
        {value}
      </p>
    </div>
  )
}

/** r=45 in a 100-unit viewBox, so the ring's full length is 2·pi·45. */
const RING_LENGTH = 2 * Math.PI * 45

/**
 * The dial IS the control. Tap it to punch in and it starts counting; tap it
 * again to punch out. The count is the current session, from zero.
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
  const showTimer = state.key !== 'not_started'

  // Monochrome to match the black-and-white identity: the active ring is the
  // white accent, not green. Break stays amber because it is a genuine
  // "paused" warning and reads clearly against the white.
  const ringClass =
    state.key === 'on_break'
      ? 'text-warning'
      : state.key === 'not_started'
        ? 'text-ink-subtle'
        : 'text-brand'

  const caption = running ? 'Tap to punch out' : 'Tap to punch in'
  const CaptionIcon = running ? LogOut : LogIn

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={busy}
      aria-label={running ? 'Punch out and stop the clock' : 'Punch in and start the clock'}
      className={cn(
        'group relative flex size-40 items-center justify-center rounded-full',
        'cursor-pointer transition-[background-color,transform] duration-300 ease-out-expo',
        'active:scale-95 disabled:cursor-not-allowed disabled:opacity-60',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface',
        state.key === 'working' && 'bg-elevated',
        state.key === 'on_break' && 'bg-warning-soft',
        state.key === 'completed' && 'bg-elevated',
        state.key === 'not_started' && 'bg-elevated hover:bg-elevated/70',
      )}
    >
      {/* -rotate-90 so the ring fills from twelve o'clock. An SVG arc starts at
          three o'clock, which reads as starting the day an hour and a half in. */}
      <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden>
        <circle cx="50" cy="50" r="45" fill="none" strokeWidth="4" className="stroke-line" />
        {showTimer && (
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            className={cn(
              'stroke-current transition-[stroke-dashoffset] duration-1000 ease-linear',
              ringClass,
            )}
            strokeDasharray={RING_LENGTH}
            strokeDashoffset={RING_LENGTH * (1 - progress)}
          />
        )}
      </svg>

      <span className="relative flex flex-col items-center gap-1.5">
        {showTimer ? (
          <span className="font-mono text-2xl font-semibold tracking-tight text-ink" data-numeric>
            {elapsed}
          </span>
        ) : (
          <Timer className={cn('size-9', ringClass)} aria-hidden />
        )}
        <span className="flex items-center gap-1 text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
          <CaptionIcon className="size-3" aria-hidden />
          {caption}
        </span>
      </span>

      {/* A ring that widens on hover, so the circle reads as pressable before
          the cursor is on it — tinted by the action. */}
      <span
        className={cn(
          'pointer-events-none absolute inset-0 rounded-full ring-2 ring-transparent transition-all duration-200',
          'group-hover:ring-offset-2 group-hover:ring-offset-surface',
          running ? 'group-hover:ring-danger/25' : 'group-hover:ring-brand/30',
        )}
        aria-hidden
      />
    </button>
  )
}

function StatusPill({ state }: { state: DerivedState }) {
  const tone =
    state.key === 'working' || state.key === 'completed'
      ? 'border-brand/25 bg-brand/10 text-brand'
      : state.key === 'on_break'
        ? 'border-warning/25 bg-warning-soft text-warning'
        : 'border-line bg-elevated text-ink-muted'

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
}

/**
 * Derived from the row, not stored. The status column and the timestamps can
 * only disagree if something wrote them directly, and the timestamps are the
 * ones payroll cares about.
 */
function deriveState(today: Attendance | null | undefined): DerivedState {
  if (!today?.punch_in) {
    return { key: 'not_started', pill: 'Off duty', headline: 'Day not started' }
  }
  if (today.punch_out) {
    return { key: 'completed', pill: 'Done', headline: 'Shift complete' }
  }
  if (today.break_started_at) {
    return { key: 'on_break', pill: 'On break', headline: 'On break' }
  }
  return { key: 'working', pill: 'Working', headline: 'Working now' }
}

function PunchCardSkeleton() {
  return (
    <Card className="flex h-full flex-col items-center p-6">
      <Skeleton className="h-3 w-28 self-start" />
      <Skeleton className="mt-8 size-40 rounded-full" />
      <Skeleton className="mt-4 h-5 w-32" />
      <Skeleton className="mt-6 h-14 w-full rounded-lg" />
    </Card>
  )
}
