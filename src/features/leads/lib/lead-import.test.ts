import { describe, expect, test } from 'vitest'
import { mapRows, parseCsv, type EmployeeRef } from './lead-import'

const PRIYA: EmployeeRef = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  name: 'Priya Sharma',
  email: 'priya@tomatovation.com',
}
const RAHUL: EmployeeRef = {
  id: 'aaaaaaaa-0000-4000-8000-000000000002',
  name: 'Rahul Verma',
  email: 'rahul@tomatovation.com',
}
/** Deliberate namesake of RAHUL — resolving by name alone is ambiguous. */
const OTHER_RAHUL: EmployeeRef = {
  id: 'aaaaaaaa-0000-4000-8000-000000000003',
  name: 'Rahul Verma',
  email: 'rahul.v@tomatovation.com',
}

const EMPLOYEES: EmployeeRef[] = [PRIYA, RAHUL, OTHER_RAHUL]

const map = (rows: string[][]) => mapRows(rows, EMPLOYEES)

/**
 * Indexing under noUncheckedIndexedAccess. Throws with a readable message
 * instead of failing on `undefined`, so a missing row says so directly.
 */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index]
  if (item === undefined) {
    throw new Error(`Expected an item at index ${index}, but there ${items.length === 1 ? 'is 1 item' : `are ${items.length} items`}`)
  }
  return item
}


describe('parseCsv', () => {
  test('splits a plain file', () => {
    expect(parseCsv('a,b\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('keeps commas inside quoted fields', () => {
    expect(parseCsv('company,remarks\nAcme,"Delhi, India"')).toEqual([
      ['company', 'remarks'],
      ['Acme', 'Delhi, India'],
    ])
  })

  test('keeps newlines inside quoted fields', () => {
    expect(parseCsv('company,remarks\nAcme,"line one\nline two"')).toEqual([
      ['company', 'remarks'],
      ['Acme', 'line one\nline two'],
    ])
  })

  test('unescapes doubled quotes', () => {
    expect(parseCsv('a\n"He said ""hi"""')).toEqual([['a'], ['He said "hi"']])
  })

  test('handles CRLF line endings', () => {
    expect(parseCsv('a,b\r\n1,2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  test('strips the BOM our own export writes', () => {
    // Without this the first header reads "﻿Company" and never matches.
    const rows = parseCsv('﻿Company,Email\nAcme,a@b.com')
    expect(at(rows, 0)[0]).toBe('Company')
  })

  test('reads a final row with no trailing newline', () => {
    expect(parseCsv('a\n1\n2')).toEqual([['a'], ['1'], ['2']])
  })

  test('drops blank trailing lines', () => {
    expect(parseCsv('a\n1\n\n\n')).toEqual([['a'], ['1']])
  })

  test('keeps empty cells as empty strings, not dropped columns', () => {
    expect(parseCsv('a,b,c\n1,,3')).toEqual([
      ['a', 'b', 'c'],
      ['1', '', '3'],
    ])
  })
})

describe('mapRows — headers', () => {
  test('matches headers regardless of case, spacing and punctuation', () => {
    const result = map([
      ['COMPANY NAME', 'Contact_Person', 'e-mail', 'Next follow-up'],
      ['Acme', 'Ann', 'ann@acme.com', '2026-08-01'],
    ])
    expect(result.issues).toEqual([])
    expect(at(result.ready, 0)).toMatchObject({
      company: 'Acme',
      contact_name: 'Ann',
      email: 'ann@acme.com',
      next_followup: '2026-08-01',
    })
  })

  test('reports a missing company column instead of importing nothing silently', () => {
    const result = map([
      ['Email', 'Phone'],
      ['a@b.com', '9876543210'],
    ])
    expect(result.ready).toEqual([])
    expect(at(result.issues, 0).message).toMatch(/no company column/i)
  })

  test('surfaces unrecognised columns so a typo is not silently dropped', () => {
    const result = map([
      ['Company', 'Budgat'],
      ['Acme', '500'],
    ])
    expect(result.ignoredColumns).toEqual(['Budgat'])
    expect(result.ready).toHaveLength(1)
  })

  test('does not flag export-only columns as unrecognised', () => {
    const result = map([
      ['Company', 'Created at', 'ID'],
      ['Acme', '2026-01-01', 'x'],
    ])
    expect(result.ignoredColumns).toEqual([])
  })
})

describe('mapRows — enums', () => {
  test('accepts display labels', () => {
    const result = map([
      ['Company', 'Source', 'Status', 'Priority'],
      ['Acme', 'Cold call', 'Qualified', 'High'],
    ])
    expect(at(result.ready, 0)).toMatchObject({ source: 'cold_call', status: 'qualified', priority: 'high' })
  })

  test('accepts raw stored values', () => {
    const result = map([
      ['Company', 'Source', 'Status'],
      ['Acme', 'email_campaign', 'negotiation'],
    ])
    expect(at(result.ready, 0)).toMatchObject({ source: 'email_campaign', status: 'negotiation' })
  })

  test('defaults blank enum cells rather than failing the row', () => {
    const result = map([['Company'], ['Acme']])
    expect(result.issues).toEqual([])
    expect(at(result.ready, 0)).toMatchObject({ status: 'new', priority: 'medium', source: 'other' })
  })

  test('rejects an unknown enum value instead of quietly defaulting it', () => {
    const result = map([
      ['Company', 'Status'],
      ['Acme', 'Nurturing'],
    ])
    expect(result.ready).toEqual([])
    expect(at(result.issues, 0)).toMatchObject({ row: 2, column: 'Status' })
  })
})

describe('mapRows — assignee', () => {
  test('resolves by email', () => {
    const result = map([
      ['Company', 'Assigned to'],
      ['Acme', 'priya@tomatovation.com'],
    ])
    expect(at(result.ready, 0).assigned_to).toBe(PRIYA.id)
  })

  test('resolves an unambiguous name', () => {
    const result = map([
      ['Company', 'Owner'],
      ['Acme', 'priya sharma'],
    ])
    expect(at(result.ready, 0).assigned_to).toBe(PRIYA.id)
  })

  test('refuses to guess between two employees with the same name', () => {
    const result = map([
      ['Company', 'Owner'],
      ['Acme', 'Rahul Verma'],
    ])
    expect(result.ready).toEqual([])
    expect(at(result.issues, 0).message).toMatch(/more than one employee/i)
  })

  test('still resolves a namesake by email', () => {
    const result = map([
      ['Company', 'Owner'],
      ['Acme', 'rahul.v@tomatovation.com'],
    ])
    expect(at(result.ready, 0).assigned_to).toBe(OTHER_RAHUL.id)
  })

  test('reports an owner who does not exist', () => {
    const result = map([
      ['Company', 'Owner'],
      ['Acme', 'Nobody'],
    ])
    expect(at(result.issues, 0).message).toMatch(/no active employee/i)
  })

  test('treats blank and "Unassigned" as no owner', () => {
    const result = map([
      ['Company', 'Owner'],
      ['Acme', ''],
      ['Globex', 'Unassigned'],
    ])
    expect(result.issues).toEqual([])
    expect(result.ready.map((lead) => lead.assigned_to)).toEqual([null, null])
  })
})

describe('mapRows — dates', () => {
  test('accepts ISO', () => {
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', '2026-08-01'],
    ])
    expect(at(result.ready, 0).next_followup).toBe('2026-08-01')
  })

  test('reads slashed dates day-first', () => {
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', '05/08/2026'],
    ])
    expect(at(result.ready, 0).next_followup).toBe('2026-08-05')
  })

  test('rejects a date whose month cannot be a month', () => {
    // 13 can only be a day, which means the file is month-first — refuse rather
    // than reinterpret, because the rest of the column would then be wrong too.
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', '08/13/2026'],
    ])
    expect(result.ready).toEqual([])
    expect(at(result.issues, 0).message).toMatch(/YYYY-MM-DD/)
  })

  test('rejects a day that does not exist in that month', () => {
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', '2026-02-31'],
    ])
    expect(at(result.issues, 0).message).toMatch(/not a real date/i)
  })

  test('accepts 29 February in a leap year', () => {
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', '2028-02-29'],
    ])
    expect(at(result.ready, 0).next_followup).toBe('2028-02-29')
  })

  test('rejects free text', () => {
    const result = map([
      ['Company', 'Next follow-up'],
      ['Acme', 'next tuesday'],
    ])
    expect(at(result.issues, 0).column).toBe('Next follow-up')
  })
})

describe('mapRows — values', () => {
  test('strips currency symbols and separators', () => {
    const result = map([
      ['Company', 'Value'],
      ['Acme', '₹1,50,000'],
    ])
    expect(at(result.ready, 0).value_estimate).toBe(150000)
  })

  test('rejects a negative amount', () => {
    const result = map([
      ['Company', 'Value'],
      ['Acme', '-500'],
    ])
    expect(at(result.issues, 0).message).toMatch(/negative/i)
  })

  test('rejects text in a value column', () => {
    const result = map([
      ['Company', 'Value'],
      ['Acme', 'about 5 lakh'],
    ])
    expect(at(result.issues, 0).column).toBe('Value estimate')
  })
})

describe('mapRows — validation and reporting', () => {
  test('imports good rows and reports bad ones in the same pass', () => {
    const result = map([
      ['Company', 'Email'],
      ['Acme', 'ann@acme.com'],
      ['', 'orphan@nowhere.com'],
      ['Globex', 'not-an-email'],
      ['Initech', 'ceo@initech.com'],
    ])
    expect(result.ready.map((lead) => lead.company)).toEqual(['Acme', 'Initech'])
    expect(result.issues).toHaveLength(2)
    expect(result.totalRows).toBe(4)
  })

  test('numbers rows the way the spreadsheet does', () => {
    const result = map([
      ['Company'],
      ['Acme'],
      [''],
    ])
    // Header is row 1, so the empty row is row 3 — not row 2, and not row 1.
    expect(at(result.issues, 0).row).toBe(3)
  })

  test('collects every problem in a row, not just the first', () => {
    const result = map([
      ['Company', 'Email', 'Status'],
      ['Acme', 'bad', 'Nurturing'],
    ])
    expect(result.issues.map((issue) => issue.column)).toEqual(['Email', 'Status'])
  })

  test('flags a row duplicated within the same file', () => {
    const result = map([
      ['Company', 'Email'],
      ['Acme', 'ann@acme.com'],
      ['acme', 'ann@acme.com'],
    ])
    expect(result.ready).toHaveLength(1)
    expect(at(result.issues, 0).message).toMatch(/same company and email as row 2/i)
  })

  test('does not treat same-company different-contact as a duplicate', () => {
    const result = map([
      ['Company', 'Email'],
      ['Acme', 'ann@acme.com'],
      ['Acme', 'bob@acme.com'],
    ])
    expect(result.ready).toHaveLength(2)
    expect(result.issues).toEqual([])
  })

  test('lowercases emails so they match what the form would have stored', () => {
    const result = map([
      ['Company', 'Email'],
      ['Acme', 'Ann@Acme.COM'],
    ])
    expect(at(result.ready, 0).email).toBe('ann@acme.com')
  })

  test('stores blank optional cells as null rather than empty strings', () => {
    const result = map([
      ['Company', 'Phone', 'Remarks'],
      ['Acme', '', ''],
    ])
    expect(at(result.ready, 0)).toMatchObject({ phone: null, remarks: null, email: null })
  })

  test('handles a short row with missing trailing cells', () => {
    const result = map([
      ['Company', 'Email', 'Remarks'],
      ['Acme'],
    ])
    expect(result.issues).toEqual([])
    expect(at(result.ready, 0)).toMatchObject({ company: 'Acme', email: null, remarks: null })
  })

  test('returns an empty preview for an empty file', () => {
    expect(map([])).toEqual({ ready: [], issues: [], totalRows: 0, ignoredColumns: [] })
  })
})
