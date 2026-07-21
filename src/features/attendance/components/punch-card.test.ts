import { describe, expect, test } from 'vitest'
import { formatClock, frozenSeconds } from './punch-card'
import type { Attendance } from '../api/attendance.api'

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

  test('holds the time worked up to the moment a break began', () => {
    // 09:00 to 12:30 is three and a half hours.
    const paused = row({ punch_in: at('09:00'), break_started_at: at('12:30') })
    expect(frozenSeconds(paused)).toBe(3.5 * 3600)
  })

  test('subtracts breaks already banked earlier in the day', () => {
    // Same span, but 20 minutes were already taken and paid back.
    const paused = row({
      punch_in: at('09:00'),
      break_started_at: at('12:30'),
      break_minutes: 20,
    })
    expect(frozenSeconds(paused)).toBe(3.5 * 3600 - 20 * 60)
  })

  test('never goes negative when the banked break exceeds the span', () => {
    // Shouldn't happen, but a clock skew or an edited row must not render a
    // negative timer rather than an obviously wrong zero.
    const odd = row({ punch_in: at('09:00'), break_started_at: at('09:05'), break_minutes: 60 })
    expect(frozenSeconds(odd)).toBe(0)
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
