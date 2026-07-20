import { describe, expect, test } from 'vitest'
import { dayOffset, dayOffsetLabel, isBusinessHours, readClock } from './world-clock'

/**
 * Fixed instants throughout — the cases that break a world clock are day
 * rollover and DST, and neither can be tested against "now".
 */

const KOLKATA = 'Asia/Kolkata'
const PRAGUE = 'Europe/Prague'
const NEW_YORK = 'America/New_York'

describe('dayOffset', () => {
  test('is zero mid-afternoon when everyone shares a date', () => {
    // 2026-07-21 14:00 IST → 10:30 Prague, 04:30 New York. Same calendar day.
    const instant = new Date('2026-07-21T08:30:00Z')
    expect(dayOffset(KOLKATA, PRAGUE, instant)).toBe(0)
    expect(dayOffset(KOLKATA, NEW_YORK, instant)).toBe(0)
  })

  test('New York is a day behind late in the Kolkata evening', () => {
    // 2026-07-21 23:30 IST is still 2026-07-21 14:00 in New York — same day.
    // An hour later it is the 22nd in Kolkata and still the 21st in New York.
    const instant = new Date('2026-07-21T19:30:00Z') // 01:00 on the 22nd IST
    expect(dayOffset(KOLKATA, NEW_YORK, instant)).toBe(-1)
  })

  test('Kolkata is a day ahead when read from New York', () => {
    const instant = new Date('2026-07-21T19:30:00Z')
    expect(dayOffset(NEW_YORK, KOLKATA, instant)).toBe(1)
  })

  test('a zone compared with itself is always zero', () => {
    expect(dayOffset(PRAGUE, PRAGUE, new Date('2026-01-01T00:00:00Z'))).toBe(0)
  })
})

describe('DST is handled by Intl, not by hand', () => {
  test('Prague is GMT+1 in January and GMT+2 in July', () => {
    const winter = readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, new Date('2026-01-15T12:00:00Z'))
    const summer = readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, new Date('2026-07-15T12:00:00Z'))

    expect(winter.offsetLabel).toBe('GMT+1')
    expect(summer.offsetLabel).toBe('GMT+2')
  })

  test('New York is GMT-5 in January and GMT-4 in July', () => {
    const winter = readClock({ label: 'NY', timeZone: NEW_YORK }, KOLKATA, new Date('2026-01-15T12:00:00Z'))
    const summer = readClock({ label: 'NY', timeZone: NEW_YORK }, KOLKATA, new Date('2026-07-15T12:00:00Z'))

    expect(winter.offsetLabel).toBe('GMT-5')
    expect(summer.offsetLabel).toBe('GMT-4')
  })

  test('the same UTC instant reads an hour apart across the DST boundary', () => {
    // 12:00 UTC is 13:00 in Prague in winter and 14:00 in summer. Hardcoding
    // an offset would show one of these wrong for months.
    const winter = readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, new Date('2026-01-15T12:00:00Z'))
    const summer = readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, new Date('2026-07-15T12:00:00Z'))

    expect(winter.time).toBe('13:00')
    expect(summer.time).toBe('14:00')
  })
})

describe('isBusinessHours', () => {
  test('true at 10:00 on a Tuesday', () => {
    // 2026-07-21 is a Tuesday. 08:00 UTC = 10:00 Prague.
    expect(isBusinessHours(PRAGUE, new Date('2026-07-21T08:00:00Z'))).toBe(true)
  })

  test('false at 08:00, before the working day', () => {
    expect(isBusinessHours(PRAGUE, new Date('2026-07-21T06:00:00Z'))).toBe(false)
  })

  test('false at 18:00 — the day has ended', () => {
    expect(isBusinessHours(PRAGUE, new Date('2026-07-21T16:00:00Z'))).toBe(false)
  })

  test('true at 17:59, the last working minute', () => {
    expect(isBusinessHours(PRAGUE, new Date('2026-07-21T15:59:00Z'))).toBe(true)
  })

  test('false on a Saturday even at midday', () => {
    // 2026-07-25 is a Saturday.
    expect(isBusinessHours(PRAGUE, new Date('2026-07-25T10:00:00Z'))).toBe(false)
  })

  test('false on a Sunday', () => {
    expect(isBusinessHours(PRAGUE, new Date('2026-07-26T10:00:00Z'))).toBe(false)
  })

  test('midnight is not treated as hour 24', () => {
    // An h12/h24 cycle would render midnight as 24 and pass `hour < 18`
    // incorrectly. 2026-07-21 04:00 UTC = 00:00 Tuesday in New York.
    expect(isBusinessHours(NEW_YORK, new Date('2026-07-21T04:00:00Z'))).toBe(false)
  })

  test('is evaluated in the TARGET zone, not the viewer’s', () => {
    // 2026-07-21 08:00 UTC: 13:30 in Kolkata (working) but 04:00 in New York.
    expect(isBusinessHours(KOLKATA, new Date('2026-07-21T08:00:00Z'))).toBe(true)
    expect(isBusinessHours(NEW_YORK, new Date('2026-07-21T08:00:00Z'))).toBe(false)
  })
})

describe('readClock', () => {
  const instant = new Date('2026-07-21T08:30:00Z')

  test('formats 24-hour time in the target zone', () => {
    const prague = readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, instant)
    expect(prague.time).toBe('10:30')
  })

  test('carries the label through unchanged', () => {
    expect(readClock({ label: 'Praha', timeZone: PRAGUE }, KOLKATA, instant).label).toBe('Praha')
  })

  test('includes a weekday so a day difference is legible', () => {
    expect(readClock({ label: 'Prague', timeZone: PRAGUE }, KOLKATA, instant).date).toContain('Tue')
  })
})

describe('dayOffsetLabel', () => {
  test('says nothing when the date matches', () => {
    expect(dayOffsetLabel(0)).toBeNull()
  })

  test('names the adjacent days plainly', () => {
    expect(dayOffsetLabel(-1)).toBe('Yesterday')
    expect(dayOffsetLabel(1)).toBe('Tomorrow')
  })

  test('falls back to a count beyond one day', () => {
    expect(dayOffsetLabel(2)).toBe('2 days ahead')
    expect(dayOffsetLabel(-2)).toBe('2 days behind')
  })
})
