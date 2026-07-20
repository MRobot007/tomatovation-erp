import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { useSettings } from '@/features/admin/hooks/use-admin'
import { CLOCK_ZONES, dayOffsetLabel, readClock } from '../lib/world-clock'
import { cn } from '@/lib/utils'

/**
 * Prague and New York alongside the office clock.
 *
 * The point is not the time, it is "can I call them now" — so each clock
 * carries a working-hours dot and says when it is a different day there. A row
 * of bare numbers makes the reader do that arithmetic themselves, which is
 * exactly the step people get wrong when the date has rolled over.
 *
 * Visible to every role: an employee logging a call needs this as much as an
 * admin does.
 */
export function WorldClocks() {
  const { data: settings } = useSettings()
  const [now, setNow] = useState(() => new Date())

  // Recomputed from the clock each tick rather than incremented, so a laptop
  // returning from sleep shows the right time immediately instead of however
  // far behind the timer fell.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  // Falls back to the browser's zone until settings load, so the row does not
  // pop in a second late.
  const officeZone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'

  const office = readClock({ label: 'Office', timeZone: officeZone }, officeZone, now)
  const others = CLOCK_ZONES.map((zone) => readClock(zone, officeZone, now))

  return (
    <Card>
      <CardContent className="flex flex-wrap items-stretch gap-x-8 gap-y-4 py-4">
        <Clock reading={office} isOffice />
        {others.map((reading) => (
          <Clock key={reading.timeZone} reading={reading} />
        ))}
      </CardContent>
    </Card>
  )
}

function Clock({
  reading,
  isOffice = false,
}: {
  reading: ReturnType<typeof readClock>
  isOffice?: boolean
}) {
  const offsetNote = dayOffsetLabel(reading.dayOffset)

  return (
    <div className="min-w-28">
      <div className="mb-1 flex items-center gap-1.5">
        <span
          className={cn(
            'size-1.5 shrink-0 rounded-full',
            reading.isBusinessHours ? 'bg-success' : 'bg-line-strong',
          )}
          aria-hidden
        />
        <p className="eyebrow truncate">{reading.label}</p>
      </div>

      <p
        className={cn(
          'font-mono font-semibold leading-none tracking-tight',
          isOffice ? 'text-2xl text-ink' : 'text-xl text-ink',
        )}
        data-numeric
      >
        {reading.time}
      </p>

      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-ink-subtle">
        <span>{reading.date}</span>
        <span className="font-mono">{reading.offsetLabel}</span>
      </p>

      {/* Only rendered when it actually differs — a "Today" label on every row
          would be noise, and this needs to stand out when it appears. */}
      {offsetNote && (
        <p className="mt-0.5 text-2xs font-medium text-warning">{offsetNote} there</p>
      )}

      <span className="sr-only">
        {reading.isBusinessHours ? 'Within working hours' : 'Outside working hours'}
      </span>
    </div>
  )
}
