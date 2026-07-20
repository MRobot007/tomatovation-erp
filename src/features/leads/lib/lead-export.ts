import { TEMPLATE_HEADERS } from './lead-import'

/**
 * Excel (.xlsx) output for leads and for the import template.
 *
 * CSV is kept alongside it because it is universal and needs no library, but a
 * real workbook removes two genuine annoyances: Excel stops prompting about the
 * format on open, and a value like +91 98765 43210 or 0091 keeps its leading
 * characters instead of being silently converted to a number — which is exactly
 * what happens to phone numbers in a CSV.
 *
 * The writer is imported on demand. It is the heaviest dependency in the app
 * and only two buttons use it, so the cost lands on whoever clicks one rather
 * than on every page load.
 */

/** Column width from the longest cell, clamped so one long note cannot blow out a column. */
function widthFor(cells: readonly string[]): number {
  const longest = cells.reduce((max, cell) => Math.max(max, cell.length), 0)
  return Math.min(Math.max(longest + 2, 12), 48)
}

async function writeWorkbook(
  rows: readonly (readonly string[])[],
  sheetName: string,
  filename: string,
): Promise<void> {
  const XLSX = await import('xlsx')

  const sheet = XLSX.utils.aoa_to_sheet(rows as string[][])

  // Sized from the content: a sheet where every column is the default width
  // means the reader's first action is always to resize them.
  const columnCount = rows[0]?.length ?? 0
  sheet['!cols'] = Array.from({ length: columnCount }, (_, index) =>
    ({ wch: widthFor(rows.map((row) => row[index] ?? '')) }),
  )

  // Header stays visible when scrolling a long pipeline.
  sheet['!freeze'] = { xSplit: 0, ySplit: 1 }

  const book = XLSX.utils.book_new()
  // Excel rejects sheet names over 31 characters or containing : \ / ? * [ ]
  XLSX.utils.book_append_sheet(book, sheet, sheetName.replace(/[:\\/?*[\]]/g, '').slice(0, 31))

  XLSX.writeFile(book, filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`)
}

export interface XlsxColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

export async function downloadXlsx<T>(
  filename: string,
  rows: readonly T[],
  columns: ReadonlyArray<XlsxColumn<T>>,
  sheetName = 'Leads',
): Promise<void> {
  const body = rows.map((row) =>
    columns.map((column) => {
      const value = column.value(row)
      return value == null ? '' : String(value)
    }),
  )

  await writeWorkbook([columns.map((column) => column.header), ...body], sheetName, filename)
}

/**
 * One filled row so the shape of each column is obvious.
 *
 * Worth the small risk of someone importing it: without an example, "Contact
 * info" and "Scope" are guesses and get filled inconsistently. The example uses
 * reserved .example domains, so it is recognisable as a sample.
 */
const TEMPLATE_EXAMPLE: Record<(typeof TEMPLATE_HEADERS)[number], string> = {
  'Name of business': 'Acme Industries Ltd',
  Country: 'India',
  'Product sector': 'Industrial pumps',
  'Contact info': 'Priya Sharma, +91 98765 43210, priya@acme.example',
  Website: 'acme.example',
  Scope: '500 units per quarter, delivered to Pune',
  Notes: 'Met at the trade fair, wants a quote by month end',
}

export async function downloadLeadTemplate(): Promise<void> {
  await writeWorkbook(
    [[...TEMPLATE_HEADERS], TEMPLATE_HEADERS.map((header) => TEMPLATE_EXAMPLE[header])],
    'Leads',
    'lead-import-template.xlsx',
  )
}
