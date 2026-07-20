import { describe, expect, test } from 'vitest'
import { exportFilename, toCsv, type ExportColumn } from './export'

interface Row {
  name: string
  hours: number | null
  note?: string
}

const columns: ReadonlyArray<ExportColumn<Row>> = [
  { header: 'Name', value: (row) => row.name },
  { header: 'Hours', value: (row) => row.hours },
  { header: 'Note', value: (row) => row.note },
]

describe('toCsv', () => {
  test('writes a header row even with no data', () => {
    expect(toCsv([], columns)).toBe('Name,Hours,Note')
  })

  test('writes plain values unquoted', () => {
    const csv = toCsv([{ name: 'Priya', hours: 8, note: 'fine' }], columns)
    expect(csv).toBe('Name,Hours,Note\r\nPriya,8,fine')
  })

  test('renders null and undefined as empty cells, not the string "null"', () => {
    const csv = toCsv([{ name: 'Priya', hours: null }], columns)
    expect(csv).toBe('Name,Hours,Note\r\nPriya,,')
  })

  test('quotes values containing a comma', () => {
    // Unquoted, this would silently become two columns and shift every field
    // after it — the classic way a CSV export corrupts a report.
    const csv = toCsv([{ name: 'Sharma, Priya', hours: 8 }], columns)
    expect(csv).toContain('"Sharma, Priya"')
  })

  test('doubles embedded quotes and wraps the value', () => {
    const csv = toCsv([{ name: 'The "Boss"', hours: 8 }], columns)
    expect(csv).toContain('"The ""Boss"""')
  })

  test('quotes values containing a newline', () => {
    const csv = toCsv([{ name: 'Line one\nLine two', hours: 8 }], columns)
    expect(csv).toContain('"Line one\nLine two"')
  })

  test('separates records with CRLF as RFC 4180 requires', () => {
    const csv = toCsv(
      [
        { name: 'A', hours: 1 },
        { name: 'B', hours: 2 },
      ],
      columns,
    )
    expect(csv.split('\r\n')).toHaveLength(3)
  })

  test('handles a value that is itself a bare quote', () => {
    const csv = toCsv([{ name: '"', hours: 0 }], columns)
    expect(csv).toContain('""""')
  })

  test('preserves zero rather than treating it as empty', () => {
    const csv = toCsv([{ name: 'Zero', hours: 0 }], columns)
    expect(csv).toBe('Name,Hours,Note\r\nZero,0,')
  })
})

describe('exportFilename', () => {
  test('includes the date range when given', () => {
    const name = exportFilename('attendance', '2026-07-01', '2026-07-31')
    expect(name).toContain('attendance_2026-07-01_to_2026-07-31')
  })

  test('omits the range when not given', () => {
    const name = exportFilename('leads')
    expect(name).toMatch(/^leads_\d{4}-\d{2}-\d{2}$/)
  })

  test('always appends a timestamp so repeat exports do not collide', () => {
    expect(exportFilename('report')).toMatch(/_\d{4}-\d{2}-\d{2}$/)
  })
})
