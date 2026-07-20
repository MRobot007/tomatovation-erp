import { Download, Printer } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { DateRangePicker, useDateRange } from '@/features/analytics/components/date-range-picker'
import { useEmployeePerformance } from '@/features/analytics/hooks/use-analytics'
import type { EmployeePerformance } from '@/features/analytics/api/analytics.api'
import { downloadCsv, exportFilename, printSection } from '@/lib/export'
import { formatHours } from '@/lib/utils'

const COLUMNS = [
  { header: 'Employee', value: (row: EmployeePerformance) => row.employee_name },
  { header: 'Department', value: (row: EmployeePerformance) => row.department },
  { header: 'Days present', value: (row: EmployeePerformance) => row.days_present },
  { header: 'Days late', value: (row: EmployeePerformance) => row.days_late },
  { header: 'Total hours', value: (row: EmployeePerformance) => row.total_hours },
  { header: 'Avg hours per day', value: (row: EmployeePerformance) => row.avg_hours },
  { header: 'Overtime hours', value: (row: EmployeePerformance) => row.overtime_hours },
  { header: 'Work logs', value: (row: EmployeePerformance) => row.work_log_count },
  { header: 'Logged hours', value: (row: EmployeePerformance) => row.logged_hours },
  { header: 'Tasks completed', value: (row: EmployeePerformance) => row.tasks_completed },
]

export function ReportsPage() {
  const { from, to, preset, setPreset } = useDateRange()
  const { data, isLoading, error, refetch } = useEmployeePerformance(from, to)

  const totals = (data ?? []).reduce(
    (accumulator, row) => ({
      hours: accumulator.hours + Number(row.total_hours),
      overtime: accumulator.overtime + Number(row.overtime_hours),
      late: accumulator.late + row.days_late,
      tasks: accumulator.tasks + row.tasks_completed,
    }),
    { hours: 0, overtime: 0, late: 0, tasks: 0 },
  )

  const columns: ReadonlyArray<Column<EmployeePerformance>> = [
    {
      id: 'employee_name',
      header: 'Employee',
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.employee_name}</p>
          {row.department && <p className="truncate text-xs text-ink-subtle">{row.department}</p>}
        </div>
      ),
    },
    { id: 'days_present', header: 'Present', numeric: true, cell: (row) => row.days_present },
    {
      id: 'days_late',
      header: 'Late',
      numeric: true,
      cell: (row) =>
        row.days_late > 0 ? (
          <span className="text-warning">{row.days_late}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    {
      id: 'total_hours',
      header: 'Hours',
      numeric: true,
      cell: (row) => formatHours(Number(row.total_hours)),
    },
    {
      id: 'avg_hours',
      header: 'Avg/day',
      numeric: true,
      cell: (row) => formatHours(Number(row.avg_hours)),
    },
    {
      id: 'overtime_hours',
      header: 'Overtime',
      numeric: true,
      cell: (row) =>
        Number(row.overtime_hours) > 0 ? (
          <span className="text-success">{formatHours(Number(row.overtime_hours))}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    { id: 'work_log_count', header: 'Logs', numeric: true, cell: (row) => row.work_log_count },
    {
      id: 'logged_hours',
      header: 'Logged',
      numeric: true,
      cell: (row) => formatHours(Number(row.logged_hours)),
    },
    { id: 'tasks_completed', header: 'Tasks', numeric: true, cell: (row) => row.tasks_completed },
  ]

  return (
    <div id="performance-report">
      <PageHeader
        eyebrow="Insight"
        title="Reports"
        description="Attendance, work logs and task completion per person, aggregated in the database."
        actions={
          <>
            <DateRangePicker preset={preset} onPresetChange={setPreset} />
            <Button
              variant="outline"
              disabled={!data || data.length === 0}
              onClick={() =>
                downloadCsv(exportFilename('performance', from, to), data ?? [], COLUMNS)
              }
            >
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print report"
              onClick={() => printSection('performance-report')}
            >
              <Printer aria-hidden />
            </Button>
          </>
        }
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Total label="Total hours" value={formatHours(totals.hours)} />
        <Total label="Overtime" value={formatHours(totals.overtime)} tone="success" />
        <Total label="Late arrivals" value={String(totals.late)} tone={totals.late > 0 ? 'warning' : undefined} />
        <Total label="Tasks completed" value={String(totals.tasks)} />
      </div>

      <div className="mb-3 flex items-center gap-2">
        <Badge tone="neutral">
          {from} to {to}
        </Badge>
        {data && <Badge tone="neutral">{data.length} people</Badge>}
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.employee_id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={{
          title: 'No data for this period',
          description: 'Attendance and work logs recorded in the range will appear here.',
        }}
      />
    </div>
  )
}

function Total({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: 'success' | 'warning'
}) {
  const toneClass =
    tone === 'success' ? 'text-success' : tone === 'warning' ? 'text-warning' : 'text-ink'

  return (
    <Card>
      <CardContent className="pt-4">
        <p className="eyebrow mb-1.5">{label}</p>
        <p
          className={`font-display text-2xl font-semibold leading-none tracking-tight ${toneClass}`}
          data-numeric
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
