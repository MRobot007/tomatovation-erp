import { useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { FormError } from '@/components/ui/form-field'
import { useEmployees } from '@/features/employees/hooks/use-employees'
import { useImportLeads } from '../hooks/use-leads'
import { mapRows, readSpreadsheet, TEMPLATE_HEADERS, type ImportPreview } from '../lib/lead-import'
import { downloadCsv } from '@/lib/export'
import { downloadLeadTemplate } from '../lib/lead-export'
import { cn } from '@/lib/utils'

const ACCEPT = '.csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

/**
 * Two rows: one filled in, one showing that everything except the business name
 * may be left blank. The second row exists so nobody assumes every column is
 * mandatory and pads the file with invented values.
 */
/** Typed off the headers, so adding a column fails to compile until it is filled in. */
type TemplateRow = Record<(typeof TEMPLATE_HEADERS)[number], string>

const TEMPLATE_ROWS: TemplateRow[] = [
  {
    'Name of business': 'Acme Foods',
    Country: 'India',
    'Product sector': 'Food processing',
    'Contact info': 'Ananya Rao, ananya@acmefoods.in',
    'Contact number': '+91 98765 43210',
    Website: 'acmefoods.in',
    Scope: 'Three plants across Pune and Nashik; wants a quote for cold storage.',
    Notes: 'Met at the Gulfood trade show.',
  },
  {
    'Name of business': 'Globex Retail',
    Country: 'UAE',
    'Product sector': '',
    'Contact info': 'buying@globex.ae',
    // Two numbers in one cell is fine — the first is stored, the rest go to the notes.
    'Contact number': '+971 50 123 4567 / 04 887 1200',
    Website: '',
    Scope: '',
    Notes: '',
  },
]

export function LeadImportDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: employees } = useEmployees({ status: 'active' })
  const importLeads = useImportLeads()

  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [fileName, setFileName] = useState<string | null>(null)
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<Error | null>(null)
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [imported, setImported] = useState<number | null>(null)

  const reset = () => {
    setFileName(null)
    setPreview(null)
    setReadError(null)
    setImported(null)
    setReading(false)
    importLeads.reset()
  }

  const close = (next: boolean) => {
    onOpenChange(next)
    // Deferred so the reset is not visible during the closing animation.
    if (!next) window.setTimeout(reset, 200)
  }

  const handleFile = async (file: File) => {
    setReading(true)
    setReadError(null)
    setPreview(null)
    setImported(null)
    setFileName(file.name)

    try {
      const rows = await readSpreadsheet(file)
      setPreview(
        mapRows(
          rows,
          (employees ?? []).map((employee) => ({
            id: employee.id,
            name: employee.name,
            email: employee.email,
          })),
        ),
      )
    } catch (error) {
      setReadError(
        error instanceof Error
          ? error
          : new Error('That file could not be read. Is it a valid CSV or Excel file?'),
      )
    } finally {
      setReading(false)
    }
  }

  const onImport = async () => {
    if (!preview?.ready.length) return
    const created = await importLeads.mutateAsync(preview.ready)
    setImported(created.length)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import leads</DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file. Only <strong>Name of business</strong> is required —
            everything else is optional and matched by column heading. Excel workbooks are read from
            the first sheet.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
          <FormError error={readError ?? importLeads.error} />

          {imported != null ? (
            <div className="flex items-start gap-3 rounded border border-success/25 bg-success-soft p-4">
              <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <div>
                <p className="font-medium text-success">
                  Imported {imported} {imported === 1 ? 'lead' : 'leads'}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  They are in the pipeline now, assigned to you as the creator.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragging(false)
                  const file = event.dataTransfer.files[0]
                  if (file) void handleFile(file)
                }}
                className={cn(
                  'rounded border border-dashed p-6 text-center transition-colors',
                  dragging ? 'border-tomato bg-tomato/5' : 'border-line-strong bg-elevated/40',
                )}
              >
                <FileSpreadsheet className="mx-auto size-7 text-ink-subtle" aria-hidden />
                <p className="mt-2 text-md font-medium text-ink">
                  {fileName ?? 'Drop a file here'}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">CSV, XLSX or XLS</p>

                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  className="sr-only"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) void handleFile(file)
                    // Reset so picking the same file again still fires onChange.
                    event.target.value = ''
                  }}
                />

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="mt-3"
                  loading={reading}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload aria-hidden />
                  {fileName ? 'Choose a different file' : 'Choose a file'}
                </Button>
              </div>

              {preview && <Preview preview={preview} />}

              {!preview && !reading && (
                <p className="text-sm text-ink-muted">
                  Not sure about the columns?{' '}
                  <button
                    type="button"
                    onClick={() => void downloadLeadTemplate()}
                    className="font-medium text-tomato underline-offset-4 hover:underline"
                  >
                    Download the Excel template
                  </button>
                  {' · '}
                  <button
                    type="button"
                    // CSV kept as a second option: some tools and older Excel
                    // installs still handle it more predictably.
                    onClick={() =>
                      downloadCsv(
                        'lead_import_template',
                        TEMPLATE_ROWS,
                        TEMPLATE_HEADERS.map((header) => ({
                          header,
                          value: (row: TemplateRow) => row[header],
                        })),
                      )
                    }
                    className="text-ink-muted underline-offset-4 hover:text-ink hover:underline"
                  >
                    CSV
                  </button>
                </p>
              )}
            </>
          )}
        </DialogBody>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => close(false)}>
            {imported != null ? 'Done' : 'Cancel'}
          </Button>
          {imported == null && (
            <Button
              type="button"
              variant="primary"
              disabled={!preview?.ready.length}
              loading={importLeads.isPending}
              onClick={onImport}
            >
              {preview?.ready.length
                ? `Import ${preview.ready.length} ${preview.ready.length === 1 ? 'lead' : 'leads'}`
                : 'Import'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Preview({ preview }: { preview: ImportPreview }) {
  const { ready, issues, totalRows, ignoredColumns } = preview
  const skipped = totalRows - ready.length

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="text-ink-muted">
          {totalRows} {totalRows === 1 ? 'row' : 'rows'} read
        </span>
        <span className="font-medium text-success">{ready.length} ready</span>
        {skipped > 0 && <span className="font-medium text-danger">{skipped} skipped</span>}
      </div>

      {ignoredColumns.length > 0 && (
        <p className="flex items-start gap-2 rounded border border-warning/25 bg-warning-soft p-2.5 text-sm text-warning">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            Ignored {ignoredColumns.length === 1 ? 'a column' : 'columns'} we do not recognise:{' '}
            <strong>{ignoredColumns.join(', ')}</strong>. Check the spelling if that was meant to
            import.
          </span>
        </p>
      )}

      {issues.length > 0 && (
        <div className="overflow-hidden rounded border border-line">
          <p className="border-b border-line bg-elevated/60 px-3 py-2 text-sm font-medium text-ink">
            {issues.length} {issues.length === 1 ? 'problem' : 'problems'} — these rows are skipped,
            the rest still import
          </p>
          <ul className="max-h-52 divide-y divide-line overflow-y-auto">
            {issues.map((issue, index) => (
              <li
                key={`${issue.row}-${issue.column}-${index}`}
                className="flex gap-3 px-3 py-1.5 text-sm"
              >
                <span className="w-14 shrink-0 font-mono text-xs text-ink-subtle" data-numeric>
                  Row {issue.row}
                </span>
                <span className="w-28 shrink-0 truncate text-ink-muted">{issue.column}</span>
                <span className="min-w-0 flex-1 text-ink">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {ready.length === 0 && issues.length === 0 && totalRows === 0 && (
        <p className="text-sm text-ink-muted">That file has no data rows.</p>
      )}
    </div>
  )
}
