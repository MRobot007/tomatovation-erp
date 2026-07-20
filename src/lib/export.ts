/**
 * CSV and print-to-PDF export.
 *
 * Deliberately dependency-free. A real xlsx writer (SheetJS et al) adds
 * ~400 kB to the bundle for a feature used a handful of times a month, and
 * Excel opens CSV natively. PDF goes through the browser's own print dialogue,
 * which already produces correct pagination and lets the user pick the printer
 * or "Save as PDF" — a bundled PDF library would reimplement all of that worse.
 */

export interface ExportColumn<T> {
  header: string
  value: (row: T) => string | number | null | undefined
}

/**
 * RFC 4180 quoting. A value containing a comma, quote or newline must be
 * wrapped and its quotes doubled, or the file silently gains extra columns.
 */
function escapeCsv(value: string | number | null | undefined): string {
  if (value == null) return ''
  const text = String(value)
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`
  return text
}

export function toCsv<T>(rows: readonly T[], columns: ReadonlyArray<ExportColumn<T>>): string {
  const header = columns.map((column) => escapeCsv(column.header)).join(',')
  const body = rows.map((row) => columns.map((column) => escapeCsv(column.value(row))).join(','))
  return [header, ...body].join('\r\n')
}

export function downloadCsv<T>(
  filename: string,
  rows: readonly T[],
  columns: ReadonlyArray<ExportColumn<T>>,
): void {
  const csv = toCsv(rows, columns)

  // The BOM makes Excel read the file as UTF-8. Without it, names with
  // accents or any non-ASCII character render as mojibake on Windows.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)

  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Revoking immediately can cancel the download in some browsers; one frame
  // is enough for the click to be handled.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Timestamped filename so repeated exports do not overwrite each other. */
export function exportFilename(base: string, from?: string, to?: string): string {
  const range = from && to ? `_${from}_to_${to}` : ''
  const stamp = new Date().toISOString().slice(0, 10)
  return `${base}${range}_${stamp}`
}

/**
 * Prints a specific element. Everything else is hidden by the print stylesheet
 * in index.css rather than by cloning into a new window, which loses computed
 * styles and every chart canvas.
 */
export function printSection(elementId: string): void {
  const target = document.getElementById(elementId)
  if (!target) {
    console.warn(`printSection: no element with id "${elementId}"`)
    return
  }

  document.body.setAttribute('data-printing', elementId)
  target.setAttribute('data-print-target', 'true')

  const cleanup = () => {
    document.body.removeAttribute('data-printing')
    target.removeAttribute('data-print-target')
    window.removeEventListener('afterprint', cleanup)
  }

  window.addEventListener('afterprint', cleanup)
  window.print()
}
