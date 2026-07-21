import { useEffect, useState } from 'react'
import { Clock as ClockIcon, Globe } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { useSettings } from '@/features/admin/hooks/use-admin'
import { CLOCK_ZONES, dayOffsetLabel, readClock } from '../lib/world-clock'
import { cn } from '@/lib/utils'

/**
 * Prague and New York alongside the office clock.
 *
 * The point is not the time, it is "can I call them now" — so each clock
 * carries its working-hours state and says when it is a different day there. A
 * column of bare numbers makes the reader do that arithmetic themselves, which
 * is exactly the step people get wrong once the date has rolled over.
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

  // Falls back to the browser's zone until settings load, so the panel does
  // not pop in a second late.
  const officeZone =
    settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC'

  const office = readClock({ label: 'Office (Local)', timeZone: officeZone }, officeZone, now)
  const others = CLOCK_ZONES.map((zone) => readClock(zone, officeZone, now))

  return (
    <Card className="flex h-full flex-col p-5">
      <div className="mb-1 flex items-center gap-2">
        <Globe className="size-3.5 text-ink-subtle" aria-hidden />
        <p className="eyebrow">Time zones</p>
      </div>

      <div className="divide-y divide-line">
        <Clock reading={office} isOffice />
        {others.map((reading) => (
          <Clock key={reading.timeZone} reading={reading} />
        ))}
      </div>
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
    <div className="flex items-center gap-3 py-3.5">
      {/* The ring is the answer to "can I call them": green means someone is
          likely at their desk. Colour carries it because that is the one thing
          worth reading from across the page. */}
      <span
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full',
          reading.isBusinessHours ? 'bg-success-soft text-success' : 'bg-elevated text-ink-subtle',
        )}
        aria-hidden
      >
        <ClockIcon className="size-4" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-ink">{reading.label}</p>
        <p
          className={cn(
            'font-display font-semibold leading-tight tracking-tight text-ink',
            isOffice ? 'text-2xl' : 'text-xl',
          )}
          data-numeric
        >
          {reading.time}
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-subtle">
          <span>{reading.date}</span>
          <span className="font-mono">{reading.offsetLabel}</span>
        </p>

        {/* Only rendered when it actually differs — a "Today" label on every
            row would be noise, and this has to stand out when it appears. */}
        {offsetNote && (
          <p className="mt-1 text-2xs font-medium text-warning">{offsetNote} there</p>
        )}
      </div>

      <span className="sr-only">
        {reading.isBusinessHours ? 'Within working hours' : 'Outside working hours'}
      </span>
    </div>
  )
}
