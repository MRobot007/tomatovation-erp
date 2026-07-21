/**
 * Spreadsheet import for leads.
 *
 * Export stays CSV (see lib/export.ts for why), but import has to accept what
 * people actually have, and what they have is a .xlsx someone sent them. The
 * xlsx reader is therefore loaded on demand — see readSpreadsheet — so the
 * bundle cost lands only on the person who picks an .xlsx, not on every page
 * load.
 *
 * Everything here is pure and synchronous apart from readSpreadsheet, because
 * the mapping rules are where the bugs live and they are much easier to test
 * without a file or a DOM.
 */

import { STATUS_LABEL, PRIORITY_LABEL, SOURCE_LABEL } from '../constants'
import type { LeadInsert, LeadPriority, LeadSource, LeadStatus } from '../api/leads.api'

export type ImportedLead = Omit<LeadInsert, 'created_by'>

export interface ImportIssue {
  /** 1-based and counting the header, so it matches what the spreadsheet shows. */
  row: number
  column: string
  message: string
}

export interface ImportPreview {
  ready: ImportedLead[]
  issues: ImportIssue[]
  /** Data rows seen, excluding the header. */
  totalRows: number
  /** Headers we did not recognise — surfaced so a typo'd column isn't silently dropped. */
  ignoredColumns: string[]
}

export interface EmployeeRef {
  id: string
  name: string
  email: string | null
}

// --- Reading ---------------------------------------------------------------

/**
 * RFC 4180. Hand-rolled rather than pulling in a parser: the format is small,
 * and the two things that actually break naive splitting — quoted commas and
 * quoted newlines — are exactly what this handles.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false

  // Our own export writes a BOM so Excel reads UTF-8; left in place it would
  // become part of the first header name and stop it matching.
  let i = text.charCodeAt(0) === 0xfeff ? 1 : 0

  while (i < text.length) {
    const char = text[i]

    if (quoted) {
      if (char === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        quoted = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"') {
      quoted = true
      i += 1
      continue
    }

    if (char === ',') {
      row.push(field)
      field = ''
      i += 1
      continue
    }

    if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
      i += 1
      continue
    }

    field += char
    i += 1
  }

  // A file that does not end in a newline still has a final field to flush.
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Trailing blank lines are normal in exported files and are not errors.
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

/**
 * Reads a picked file into raw cell rows.
 *
 * The xlsx branch is a dynamic import so the reader is a separate chunk. A user
 * who only ever imports CSV never downloads it.
 */
export async function readSpreadsheet(file: File): Promise<string[][]> {
  const isExcel = /\.xlsx?$/i.test(file.name)

  if (!isExcel) {
    return parseCsv(await file.text())
  }

  // The package ships no root entry — /browser is the build that takes a File.
  const { default: readXlsxFile } = await import('read-excel-file/browser')

  // Returns every sheet in the workbook, not the rows of one. Only the first is
  // imported: a lead list is one table, and silently concatenating a "Notes" or
  // "Pivot" tab onto it would be worse than ignoring it.
  const sheets = await readXlsxFile(file)
  const first = sheets[0]
  if (!first) throw new Error('That workbook has no sheets')

  // Cells come back typed (numbers, Dates). Normalising to string here keeps
  // one code path downstream; toCellText preserves dates as ISO, which is the
  // one conversion String() would get wrong.
  return first.data
    .map((cells) => cells.map(toCellText))
    .filter((cells) => cells.some((cell) => cell.trim() !== ''))
}

function toCellText(value: unknown): string {
  if (value == null) return ''
  if (value instanceof Date) return toIsoDate(value)
  return String(value).trim()
}

/**
 * Excel hands back a Date at UTC midnight for a date-formatted cell. Formatting
 * through local time would shift it a day backwards for anyone west of UTC, so
 * the UTC parts are read directly.
 */
function toIsoDate(date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  const day = String(date.getUTCDate()).padStart(2, '0')
  return `${date.getUTCFullYear()}-${month}-${day}`
}

// --- Header mapping --------------------------------------------------------

type Field =
  | 'company'
  | 'contact_name'
  | 'phone'
  | 'email'
  /** One cell holding some mix of name, phone and email — split on read. */
  | 'contact_info'
  | 'country'
  | 'product_sector'
  | 'website'
  | 'scope'
  | 'source'
  | 'status'
  | 'priority'
  | 'assigned_to'
  | 'value_estimate'
  | 'next_followup'
  | 'remarks'

/** Lowercased and stripped of punctuation, so "Next follow-up" == "next_followup". */
function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

const HEADERS: Record<Field, readonly string[]> = {
  company: [
    'company',
    'companyname',
    'nameofbusiness',
    'businessname',
    'organisation',
    'organization',
    'account',
    'business',
  ],
  contact_name: ['contactname', 'contact', 'name', 'contactperson', 'person'],
  phone: [
    'phone',
    'phonenumber',
    'phonenumbers',
    'phoneno',
    'contactphone',
    'contactnumber',
    'contactnumbers',
    'contactno',
    'mobile',
    'mobileno',
    'mobilenumber',
    'cell',
    'cellphone',
    'whatsapp',
    'whatsappnumber',
    'landline',
    'tel',
    'telephone',
  ],
  email: ['email', 'emailaddress', 'mail'],
  contact_info: ['contactinfo', 'contactdetails', 'contactdetail', 'contacts'],
  country: ['country', 'region', 'market', 'location'],
  product_sector: ['productsector', 'sector', 'industry', 'product', 'productcategory', 'vertical'],
  // "Website (if any)" normalises to websiteifany — people paste the heading
  // verbatim out of a brief, parenthetical and all.
  website: ['website', 'websiteifany', 'url', 'web', 'site', 'webaddress'],
  scope: ['scope', 'requirement', 'requirements', 'opportunity'],
  source: ['source', 'leadsource'],
  status: ['status', 'leadstatus', 'stage'],
  priority: ['priority'],
  assigned_to: ['assignedto', 'assignee', 'owner', 'assigned', 'salesrep', 'repname'],
  value_estimate: ['valueestimate', 'value', 'dealvalue', 'amount', 'estimatedvalue', 'estvalue'],
  next_followup: ['nextfollowup', 'followup', 'followupdate', 'nextfollowupdate', 'nextcontact'],
  remarks: ['remarks', 'notes', 'note', 'comments', 'comment', 'description'],
}

/**
 * Columns our own export writes that cannot be imported back. Recognised so a
 * round-trip — export, edit, re-import — does not report them as unknown.
 */
const EXPORT_ONLY = new Set(['id', 'createdat', 'createdby', 'updatedat', 'created', 'addedby'])

const HEADER_LOOKUP = new Map<string, Field>(
  Object.entries(HEADERS).flatMap(([field, aliases]) =>
    aliases.map((alias) => [alias, field as Field] as const),
  ),
)

/** Reverse index from both the display label and the stored value. */
function enumLookup<T extends string>(labels: Record<T, string>): Map<string, T> {
  const lookup = new Map<string, T>()
  for (const [value, label] of Object.entries(labels) as Array<[T, string]>) {
    lookup.set(normalise(value), value)
    lookup.set(normalise(label), value)
  }
  return lookup
}

const STATUS_LOOKUP = enumLookup<LeadStatus>(STATUS_LABEL)
const PRIORITY_LOOKUP = enumLookup<LeadPriority>(PRIORITY_LABEL)
const SOURCE_LOOKUP = enumLookup<LeadSource>(SOURCE_LABEL)

// --- Cell coercion ---------------------------------------------------------

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DMY_DATE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/

/**
 * Accepts ISO, or day-first as written across India where this is used.
 * Month-first is deliberately NOT guessed: 03/04/2026 is a real date under both
 * readings, so guessing wrong silently books a follow-up in the wrong month.
 */
function parseDate(raw: string): { value: string } | { error: string } {
  const iso = ISO_DATE.exec(raw)
  if (iso) {
    const [, year = '', month = '', day = ''] = iso
    return isRealDate(+year, +month, +day)
      ? { value: raw }
      : { error: `"${raw}" is not a real date` }
  }

  const dmy = DMY_DATE.exec(raw)
  if (dmy) {
    const [, day = '', month = '', year = ''] = dmy
    if (+month > 12) return { error: `"${raw}" has no valid month — use YYYY-MM-DD` }
    if (!isRealDate(+year, +month, +day)) return { error: `"${raw}" is not a real date` }
    return { value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}` }
  }

  return { error: `Use YYYY-MM-DD or DD/MM/YYYY, not "${raw}"` }
}

/** Rejects 2026-02-31, which Date would happily roll into March. */
function isRealDate(year: number, month: number, day: number): boolean {
  if (month < 1 || month > 12 || day < 1) return false
  return day <= new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/** Strips ₹, thousands separators and spaces — spreadsheets are full of them. */
function parseAmount(raw: string): { value: number } | { error: string } {
  const cleaned = raw.replace(/[₹$€£,\s]/g, '')
  const amount = Number(cleaned)
  if (!Number.isFinite(amount)) return { error: `"${raw}" is not a number` }
  if (amount < 0) return { error: 'Value cannot be negative' }
  return { value: amount }
}

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/** Mirrors the column constraint — the last word on what can be stored. */
const PHONE = /^[0-9+\-\s()]{6,20}$/

/*
 * Phone numbers arrive in whatever shape the sender's CRM exported them, and
 * the column only accepts [0-9+-\s()] up to 20 characters. Validating the raw
 * cell against that meant "+91.98765.43210" failed and, because a failed cell
 * rejects the whole row, the company was dropped over a full stop.
 *
 * So these coerce rather than reject: a leading "Tel:", an extension, dots and
 * slashes all come off, and what remains is judged on its digit count. Only a
 * cell with no usable number left in it is reported as a problem.
 */
const PHONE_LABEL = /^\s*(?:tel|telephone|phone|ph|mob|mobile|cell|contact|whatsapp|wa)\b\s*(?:nos?\.?|numbers?)?\s*[.:\-]*\s*/i
const PHONE_EXTENSION = /\s*(?:x|ext|extn|extension)\s*[.:]?\s*(\d{1,6})\s*$/i
/** What people put *between* two numbers in one cell. */
const PHONE_SEPARATOR = /\s*(?:[/,;|]|\bor\b|\band\b)\s*/i

export interface PhoneRead {
  /** Normalised and safe to store, or '' when the cell held no number. */
  value: string
  /** Further numbers and extensions from the same cell, in reading order. */
  extra: string[]
}

function normaliseOnePhone(raw: string): string {
  const trimmed = raw.replace(PHONE_LABEL, '').trim()
  if (!trimmed) return ''

  const hasPlus = trimmed.startsWith('+')
  // Dots and underscores are separators someone typed; anything else the
  // column cannot hold is dropped rather than failing the row.
  const body = trimmed
    .replace(/[._]/g, ' ')
    .replace(/[^0-9\-\s()]/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const digits = body.replace(/\D/g, '')
  // E.164 tops out at 15 digits. Below 6 it is a house number, not a phone.
  if (digits.length < 6 || digits.length > 15) return ''

  const spaced = `${hasPlus ? '+' : ''}${body}`
  // Too decorated to store as written — keep the number, drop the decoration.
  return spaced.length <= 20 ? spaced : `${hasPlus ? '+' : ''}${digits}`
}

/**
 * Reads every number out of one cell. The first is what gets stored, since the
 * column holds one; the rest come back separately so the caller can keep them
 * somewhere rather than bin them.
 */
export function readPhone(raw: string): PhoneRead {
  const found: Array<{ number: string; extension: string }> = []

  for (const part of raw.split(PHONE_SEPARATOR)) {
    if (!part.trim()) continue
    const match = PHONE_EXTENSION.exec(part)
    const number = normaliseOnePhone(match ? part.slice(0, match.index) : part)
    if (number) found.push({ number, extension: match?.[1] ?? '' })
  }

  const [first, ...rest] = found
  if (!first) return { value: '', extra: [] }

  return {
    value: first.number,
    extra: [
      ...(first.extension ? [`ext ${first.extension}`] : []),
      ...rest.map((entry) => (entry.extension ? `${entry.number} ext ${entry.extension}` : entry.number)),
    ],
  }
}

/*
 * Brackets and quotes are excluded on both sides, or "Ann <ann@acme.com>" —
 * how every mail client formats a contact — yields "<ann@acme.com>", which is
 * still shaped like an email and passes validation, so it would be stored
 * broken rather than rejected. The domain also refuses a trailing dot so a
 * sentence-ending "…at ann@acme.com." does not swallow the full stop.
 */
const ADDRESS_STOP = '\\s,;|<>()[\\]{}"\''
const EMAIL_ANYWHERE = new RegExp(
  `[^${ADDRESS_STOP}]+@[^${ADDRESS_STOP}]+\\.[^${ADDRESS_STOP}.]+`,
)
// Dots included so "Ann Rao +91.98765.43210" lifts the number out instead of
// leaving it glued to the name. readPhone normalises whatever this matches.
const PHONE_ANYWHERE = /\+?[0-9][0-9.\-\s()]{5,19}/

/**
 * "Contact info" is usually one cell holding some mix of a person, a number and
 * an address — "Ann Rao, +91 98765 43210, ann@acme.in". Splitting it beats
 * dropping it into remarks, because phone and email are searchable columns.
 *
 * Whatever is left after both are lifted out is treated as the person's name;
 * if that leaves nothing recognisable, the name is simply absent rather than
 * some fragment of punctuation.
 */
function splitContactInfo(raw: string): { name: string; phone: string; email: string } {
  let rest = raw

  const email = EMAIL_ANYWHERE.exec(rest)?.[0] ?? ''
  if (email) rest = rest.replace(email, ' ')

  const phone = PHONE_ANYWHERE.exec(rest)?.[0]?.trim() ?? ''
  if (phone) rest = rest.replace(phone, ' ')

  // Separators are what is left holding the pieces together, not part of a name.
  const name = rest.replace(/[,;|/]+/g, ' ').replace(/\s+/g, ' ').trim()

  return { name, phone, email: email.toLowerCase() }
}

// --- Mapping ---------------------------------------------------------------

/**
 * Turns raw cells into insertable leads, collecting every problem rather than
 * stopping at the first. A 200-row file with 3 bad rows should tell you about
 * all 3 at once, and still let you import the other 197.
 */
export function mapRows(rows: string[][], employees: readonly EmployeeRef[]): ImportPreview {
  if (rows.length === 0) {
    return { ready: [], issues: [], totalRows: 0, ignoredColumns: [] }
  }

  const [header = [], ...body] = rows
  const ignoredColumns: string[] = []
  const columns = header.map((raw) => {
    const key = normalise(raw)
    const field = HEADER_LOOKUP.get(key)
    if (!field && key && !EXPORT_ONLY.has(key)) ignoredColumns.push(raw.trim())
    return field
  })

  const issues: ImportIssue[] = []
  const ready: ImportedLead[] = []

  if (!columns.includes('company')) {
    issues.push({ row: 1, column: 'Company', message: 'No company column found — it is required' })
    return { ready, issues, totalRows: body.length, ignoredColumns }
  }

  // Resolved once, not per row: a 500-row file would otherwise rebuild these
  // 500 times.
  const byEmail = new Map<string, EmployeeRef>()
  const byName = new Map<string, EmployeeRef[]>()
  for (const employee of employees) {
    if (employee.email) byEmail.set(employee.email.toLowerCase(), employee)
    const key = normalise(employee.name)
    byName.set(key, [...(byName.get(key) ?? []), employee])
  }

  const seen = new Map<string, number>()

  body.forEach((cells, index) => {
    const rowNumber = index + 2 // +1 for the header, +1 because rows are 1-based.
    const rowIssues: ImportIssue[] = []
    const fail = (column: string, message: string) => rowIssues.push({ row: rowNumber, column, message })

    const cell = (field: Field): string => {
      const at = columns.indexOf(field)
      return at === -1 ? '' : (cells[at] ?? '').trim()
    }

    const company = cell('company')
    if (!company) fail('Name of business', 'A business name is required')
    else if (company.length > 160) fail('Name of business', 'Business name is too long (max 160)')

    // A dedicated Email/Phone/Contact name column always wins; the combined
    // cell only fills what those left empty.
    const combined = splitContactInfo(cell('contact_info'))

    const email = (cell('email') || combined.email).toLowerCase()
    if (email && !EMAIL.test(email)) fail('Email', `"${email}" is not a valid email`)

    const rawPhone = cell('phone') || combined.phone
    const { value: phone, extra: extraPhones } = readPhone(rawPhone)
    // A cell with no digits at all is a placeholder — "n/a", "-", "none". That
    // is an empty phone number, not a failed one, and must not reject the row.
    if (rawPhone && !phone && /\d/.test(rawPhone)) {
      fail('Phone', `No phone number could be read from "${rawPhone}"`)
    } else if (phone && !PHONE.test(phone)) {
      fail('Phone', `"${phone}" cannot be stored as a phone number`)
    }

    const contactName = cell('contact_name') || combined.name
    if (contactName.length > 120) fail('Contact name', 'Contact name is too long (max 120)')

    // A second number, or an extension, has nowhere to live in the single
    // phone column. Appending keeps it on the lead instead of dropping it.
    const remarks = [cell('remarks'), extraPhones.length > 0 ? `Also: ${extraPhones.join(', ')}` : '']
      .filter(Boolean)
      .join('\n')
    if (remarks.length > 4000) fail('Notes', 'Notes are too long (max 4000)')

    const country = cell('country')
    if (country.length > 80) fail('Country', 'Country is too long (max 80)')

    const productSector = cell('product_sector')
    if (productSector.length > 120) fail('Product sector', 'Product sector is too long (max 120)')

    const website = cell('website')
    if (website.length > 255) fail('Website', 'Website is too long (max 255)')

    const scope = cell('scope')
    if (scope.length > 2000) fail('Scope', 'Scope is too long (max 2000)')

    // Blank enum cells fall back to the same defaults the new-lead form uses,
    // so a file with only companies in it still imports.
    const status = resolveEnum(cell('status'), STATUS_LOOKUP, 'new')
    if ('error' in status) fail('Status', `"${cell('status')}" is not a known status`)

    const priority = resolveEnum(cell('priority'), PRIORITY_LOOKUP, 'medium')
    if ('error' in priority) fail('Priority', `"${cell('priority')}" is not a known priority`)

    const source = resolveEnum(cell('source'), SOURCE_LOOKUP, 'other')
    if ('error' in source) fail('Source', `"${cell('source')}" is not a known source`)

    let assignedTo: string | null = null
    const owner = cell('assigned_to')
    if (owner && normalise(owner) !== 'unassigned' && normalise(owner) !== 'none') {
      if (UUID.test(owner)) {
        assignedTo = owner
      } else {
        const match = byEmail.get(owner.toLowerCase()) ?? byName.get(normalise(owner))?.[0]
        const namesakes = byName.get(normalise(owner))
        if (!match) {
          fail('Assigned to', `No active employee matches "${owner}"`)
        } else if (!owner.includes('@') && namesakes && namesakes.length > 1) {
          // Two people called the same thing: picking one silently would assign
          // the lead to a coin flip.
          fail('Assigned to', `More than one employee is called "${owner}" — use their email`)
        } else {
          assignedTo = match.id
        }
      }
    }

    let valueEstimate: number | null = null
    const rawValue = cell('value_estimate')
    if (rawValue) {
      const parsed = parseAmount(rawValue)
      if ('error' in parsed) fail('Value estimate', parsed.error)
      else valueEstimate = parsed.value
    }

    let nextFollowup: string | null = null
    const rawDate = cell('next_followup')
    if (rawDate) {
      const parsed = parseDate(rawDate)
      if ('error' in parsed) fail('Next follow-up', parsed.error)
      else nextFollowup = parsed.value
    }

    // Re-importing a file you already imported is the easy mistake to make.
    // Only duplicates *within the file* are caught here — that is what can be
    // known without a round-trip to the database.
    const identity = `${normalise(company)}|${email}`
    if (company) {
      const first = seen.get(identity)
      if (first != null) fail('Company', `Same company and email as row ${first}`)
      else seen.set(identity, rowNumber)
    }

    if (rowIssues.length > 0) {
      issues.push(...rowIssues)
      return
    }

    ready.push({
      company,
      contact_name: contactName || null,
      phone: phone || null,
      email: email || null,
      country: country || null,
      product_sector: productSector || null,
      website: website || null,
      scope: scope || null,
      source: (source as { value: LeadSource }).value,
      status: (status as { value: LeadStatus }).value,
      priority: (priority as { value: LeadPriority }).value,
      assigned_to: assignedTo,
      value_estimate: valueEstimate,
      next_followup: nextFollowup,
      remarks: remarks || null,
    })
  })

  return { ready, issues, totalRows: body.length, ignoredColumns }
}

function resolveEnum<T extends string>(
  raw: string,
  lookup: Map<string, T>,
  fallback: T,
): { value: T } | { error: true } {
  if (!raw) return { value: fallback }
  const match = lookup.get(normalise(raw))
  return match ? { value: match } : { error: true }
}

/**
 * The columns the downloadable template ships with — the qualification detail
 * you actually have when a lead first arrives.
 *
 * The importer accepts more than this (Status, Priority, Source, Assigned to,
 * Value estimate, Next follow-up); they are left out of the template because a
 * brand-new lead has none of them, and a template full of columns you must
 * leave blank invites people to invent values for them. Blank ones default to
 * New / Medium / Other on import, and the export writes the full set.
 */
export const TEMPLATE_HEADERS = [
  'Name of business',
  'Country',
  'Product sector',
  'Contact info',
  'Contact number',
  'Website',
  'Scope',
  'Notes',
] as const
