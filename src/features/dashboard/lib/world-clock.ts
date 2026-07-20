/**
 * World clock arithmetic.
 *
 * Everything here is pure and takes an explicit `now`, so the behaviour that
 * actually breaks — day rollover and DST — can be tested at a fixed instant
 * instead of only being observable twice a year.
 *
 * Intl handles the zone conversion and DST, so nothing here does date maths by
 * hand. Adding or subtracting hours manually is what produces clocks that are
 * an hour wrong for three weeks each spring.
 */

export interface ClockZone {
  /** What the row is labelled. */
  label: string
  /** IANA identifier. Intl applies the correct DST offset for the date. */
  timeZone: string
}

/**
 * Edit this list to change which clocks appear.
 *
 * The US is deliberately named by city, not "US": it spans four zones, and a
 * single clock labelled "US" invites someone to call Los Angeles at 6am.
 */
export const CLOCK_ZONES: readonly ClockZone[] = [
  { label: 'Prague', timeZone: 'Europe/Prague' },
  { label: 'New York', timeZone: 'America/New_York' },
]

export interface ClockReading {
  label: string
  timeZone: string
  /** 24-hour HH:MM in that zone. */
  time: string
  /** Short weekday and date, e.g. "Mon 21 Jul". */
  date: string
  /** Offset from the viewer's own calendar day: -1, 0 or +1. */
  dayOffset: number
  /** Whether it is a normal working hour there right now. */
  isBusinessHours: boolean
  /** e.g. "GMT+2" — makes the difference explicit rather than implied. */
  offsetLabel: string
}

/** Calendar date in a zone, as YYYY-MM-DD. Comparable as a string. */
function dateKeyIn(timeZone: string, instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(instant)
}

function hourIn(timeZone: string, instant: Date): number {
  // hourCycle h23 so midnight is 0 and not 24, which would fail every
  // comparison below.
  return Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(
      instant,
    ),
  )
}

/** 1 = Monday … 7 = Sunday, matching ISO. */
function isoWeekdayIn(timeZone: string, instant: Date): number {
  const name = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'short' }).format(instant)
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  return days.indexOf(name) + 1
}

/**
 * Working hours in the target zone: 09:00–17:59, Monday to Friday.
 *
 * A rough heuristic, and only ever a hint about whether someone is likely to
 * pick up. It knows nothing about that country's public holidays.
 */
export function isBusinessHours(timeZone: string, instant: Date): boolean {
  const weekday = isoWeekdayIn(timeZone, instant)
  if (weekday > 5) return false

  const hour = hourIn(timeZone, instant)
  return hour >= 9 && hour < 18
}

/**
 * Whole days between the viewer's calendar date and the target's.
 *
 * Compared as calendar dates rather than by dividing an offset in hours: at
 * 23:30 in Kolkata it is still the previous day in New York, and that is a
 * date difference, not a duration.
 */
export function dayOffset(viewerZone: string, targetZone: string, instant: Date): number {
  const viewer = dateKeyIn(viewerZone, instant)
  const target = dateKeyIn(targetZone, instant)
  if (viewer === target) return 0

  // Parsed as UTC on both sides, so the subtraction is a pure date difference
  // with no zone involved.
  const diffMs = Date.parse(`${target}T00:00:00Z`) - Date.parse(`${viewer}T00:00:00Z`)
  return Math.round(diffMs / 86_400_000)
}

export function readClock(zone: ClockZone, viewerZone: string, instant: Date): ClockReading {
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(instant)

  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: zone.timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(instant)

  const offsetLabel =
    new Intl.DateTimeFormat('en-GB', { timeZone: zone.timeZone, timeZoneName: 'shortOffset' })
      .formatToParts(instant)
      .find((part) => part.type === 'timeZoneName')?.value ?? ''

  return {
    label: zone.label,
    timeZone: zone.timeZone,
    time,
    date,
    dayOffset: dayOffset(viewerZone, zone.timeZone, instant),
    isBusinessHours: isBusinessHours(zone.timeZone, instant),
    offsetLabel,
  }
}

/** "Yesterday there" / "Tomorrow there" — only when it differs. */
export function dayOffsetLabel(offset: number): string | null {
  if (offset === 0) return null
  if (offset === -1) return 'Yesterday'
  if (offset === 1) return 'Tomorrow'
  return offset < 0 ? `${Math.abs(offset)} days behind` : `${offset} days ahead`
}
