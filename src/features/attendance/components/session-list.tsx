import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

interface Session {
  id: string
  punch_in: string
  punch_out: string | null
}

function formatTime(value: string): string {
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function spanMinutes(session: Session): number {
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
 * Every punch-in and punch-out of the day, in order.
 *
 * Only shown once there is more than one. A single session is exactly what the
 * two ledger rows above already say, and repeating it would be a list for the
 * sake of having a list.
 */
export function SessionList({ attendanceId }: { attendanceId: string | null | undefined }) {
  const { data: sessions } = useQuery({
    // Nested under ['attendance'] on purpose: usePunchActions invalidates that
    // whole prefix, so this refetches after every punch for free. A key of
    // ['attendance-sessions', ...] looks related but matches nothing — React
    // Query compares array elements, and that string is simply a different
    // one, so the list would sit stale until a reload.
    queryKey: ['attendance', 'sessions', attendanceId],
    enabled: Boolean(attendanceId),
    queryFn: async (): Promise<Session[]> => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id, punch_in, punch_out')
        .eq('attendance_id', attendanceId as string)
        .order('punch_in', { ascending: true })

      if (error) throw error
      return data ?? []
    },
  })

  if (!sessions || sessions.length < 2) return null

  const worked = sessions.reduce((sum, session) => sum + spanMinutes(session), 0)

  return (
    <div className="mt-4 rounded-lg border border-line">
      <div className="flex items-baseline justify-between border-b border-line px-3.5 py-2">
        <p className="eyebrow">
          {sessions.length} sessions today
        </p>
        <p className="font-mono text-xs text-ink-muted" data-numeric>
          {formatSpan(worked)} total
        </p>
      </div>

      <ol className="divide-y divide-line">
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
              <span
                className={cn('font-mono', open ? 'text-success' : 'text-ink')}
                data-numeric
              >
                {session.punch_out ? formatTime(session.punch_out) : 'now'}
              </span>
              <span className="ml-auto font-mono text-xs text-ink-muted" data-numeric>
                {formatSpan(spanMinutes(session))}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
