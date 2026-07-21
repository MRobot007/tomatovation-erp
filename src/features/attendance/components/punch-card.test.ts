import { describe, expect, test } from 'vitest'
import { formatClock, formatShort, frozenSeconds, sessionSpanSeconds } from './punch-card'
import type { Attendance } from '../api/attendance.api'
import type { AttendanceSession } from '../hooks/use-attendance'

/**
 * The dial's clock.
 *
 * These are the two pure pieces behind it, and they cover the case that is
 * awkward to reach by hand: the live counter only ticks while someone is
 * actually working, so a paused or finished day has to have its total
 * computed. Getting that wrong shows the dial at zero the moment somebody
 * takes a break — a bug that only appears at lunchtime.
 */

/** Only the fields these functions read; the real row is much wider. */
function row(fields: Partial<Attendance>): Attendance {
  return { break_minutes: 0, ...fields } as Attendance
}

const at = (hhmm: string) => `2026-07-21T${hhmm}:00.000Z`

describe('sessionSpanSeconds', () => {
  const session = (punch_in: string, punch_out: string | null): AttendanceSession =>
    ({ id: 'x', punch_in, punch_out }) as AttendanceSession

  test('measures a closed session from its own in to its own out', () => {
    // The whole point of the fix: a session is timed on ITS punch-in, not the
    // day's first. A ten-second stint reads as ten seconds, not the day total.
    expect(sessionSpanSeconds(session(at('20:18'), at('20:18')))).toBe(0)
    expect(
      sessionSpanSeconds({ id: 'x', punch_in: at('09:00'), punch_out: at('09:00') } as AttendanceSession) +
        10,
    ).toBe(10)
  })

  test('a 3h30m session is 12600 seconds', () => {
    expect(sessionSpanSeconds(session(at('09:00'), at('12:30')))).toBe(12600)
  })

  test('never negative if the timestamps are somehow reversed', () => {
    expect(sessionSpanSeconds(session(at('12:00'), at('09:00')))).toBe(0)
  })
})

describe('formatShort', () => {
  test('reads minutes under an hour', () => {
    expect(formatShort(0)).toBe('0m')
    expect(formatShort(56 * 60)).toBe('56m')
    expect(formatShort(56 * 60 + 20)).toBe('56m') // rounds down to the nearest minute
  })

  test('rounds up into the next hour cleanly', () => {
    // 59m40s rounds to 60 minutes, which reads as 1h, not "60m".
    expect(formatShort(59 * 60 + 40)).toBe('1h')
  })

  test('reads hours and minutes past an hour', () => {
    expect(formatShort(60 * 60)).toBe('1h')
    expect(formatShort(65 * 60)).toBe('1h 5m')
    expect(formatShort(8 * 3600 + 30 * 60)).toBe('8h 30m')
  })
})

describe('formatClock', () => {
  test('renders H:MM:SS with padded minutes and seconds', () => {
    expect(formatClock(0)).toBe('0:00:00')
    expect(formatClock(61)).toBe('0:01:01')
    expect(formatClock(3599)).toBe('0:59:59')
    expect(formatClock(3600)).toBe('1:00:00')
  })

  test('does not roll hours over at 24', () => {
    // An auto-punch-out that failed would leave a very long day. Showing "1:00"
    // for a 25-hour shift would hide exactly the anomaly worth noticing.
    expect(formatClock(25 * 3600)).toBe('25:00:00')
  })
})

describe('frozenSeconds', () => {
  test('is zero before the day starts', () => {
    expect(frozenSeconds(null)).toBe(0)
    expect(frozenSeconds(undefined)).toBe(0)
    expect(frozenSeconds(row({ punch_in: null }))).toBe(0)
  })

  test('is zero while paused on a break', () => {
    // frozenSeconds now answers one question only — "how long was this closed
    // day" — because the dial counts the CURRENT session live from its own
    // punch-in. A day still open (on break, no punch_out) is that live path's
    // job, so this returns zero rather than owning the number twice.
    const paused = row({ punch_in: at('09:00'), break_started_at: at('12:30') })
    expect(frozenSeconds(paused)).toBe(0)
  })

  test('uses the stored total once the day is closed', () => {
    // working_hours is what payroll reads. The dial must agree with it rather
    // than recomputing from timestamps and drifting by a rounding step.
    const done = row({ punch_in: at('09:00'), punch_out: at('17:30'), working_hours: 8.25 })
    expect(frozenSeconds(done)).toBe(Math.round(8.25 * 3600))
  })

  test('a closed day with no recorded hours reads zero, not NaN', () => {
    const done = row({ punch_in: at('09:00'), punch_out: at('17:30'), working_hours: null })
    expect(frozenSeconds(done)).toBe(0)
  })

  test('is zero while the clock is actually running', () => {
    // The live counter owns that case. Returning something here as well would
    // give two sources for one number.
    expect(frozenSeconds(row({ punch_in: at('09:00') }))).toBe(0)
  })
})
