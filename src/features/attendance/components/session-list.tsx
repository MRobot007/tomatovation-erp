import { ChevronDown } from 'lucide-react'
import { useTodaySessions, type AttendanceSession } from '../hooks/use-attendance'

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function spanMinutes(session: AttendanceSession): number {
  const end = session.punch_out ? new Date(session.punch_out).getTime() : Date.now()
  return Math.max(0, Math.round((end - new Date(session.punch_in).getTime()) / 60000))
}

function formatSpan(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (hours === 0) return `${rest}m`
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`
}

/**
 * The day's punch-in/out sessions, tucked into a disclosure.
 *
 * Collapsed by default so the card stays minimal — the dial and its three facts
 * are the story, and the full ledger is one tap away for anyone who wants it.
 * Only rendered once there is more than one session; a single one is exactly
 * what the dial and "First in" already say.
 */
export function SessionList({ attendanceId }: { attendanceId: string | null | undefined }) {
  const { data: sessions } = useTodaySessions(attendanceId)

  if (!sessions || sessions.length < 2) return null

  const worked = sessions.reduce((sum, session) => sum + spanMinutes(session), 0)

  return (
    <details className="group mt-4 overflow-hidden rounded-lg border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between px-3.5 py-2.5 transition-colors hover:bg-elevated/50">
        <span className="text-2xs font-semibold uppercase tracking-wide text-ink-subtle">
          {sessions.length} sessions today
        </span>
        <span className="flex items-center gap-2 text-ink-muted">
          <span className="font-mono text-xs" data-numeric>
            {formatSpan(worked)} total
          </span>
          <ChevronDown
            className="size-4 shrink-0 transition-transform duration-200 group-open:rotate-180"
            aria-hidden
          />
        </span>
      </summary>

      <ol className="divide-y divide-line border-t border-line">
        {sessions.map((session, index) => {
          const open = session.punch_out == null
          return (
            <li key={session.id} className="flex items-center gap-3 px-3.5 py-2 text-sm">
              <span className="w-4 shrink-0 font-mono text-xs text-ink-subtle" data-numeric>
                {index + 1}
              </span>
              <span className="font-mono text-ink" data-numeric>
                {formatTime(session.punch_in)}
              </span>
              <span className="text-ink-subtle" aria-hidden>
                &rarr;
              </span>
              <span className={open ? 'font-mono text-success' : 'font-mono text-ink'} data-numeric>
                {session.punch_out ? formatTime(session.punch_out) : 'now'}
              </span>
              <span className="ml-auto font-mono text-xs text-ink-muted" data-numeric>
                {formatSpan(spanMinutes(session))}
              </span>
            </li>
          )
        })}
      </ol>
    </details>
  )
}
