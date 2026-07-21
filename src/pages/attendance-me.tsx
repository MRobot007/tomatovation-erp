import { Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { PunchCard } from '@/features/attendance/components/punch-card'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { useMyAttendanceHistory } from '@/features/attendance/hooks/use-attendance'
import type { Attendance } from '@/features/attendance/api/attendance.api'
import { formatHours } from '@/lib/utils'

const STATUS_TONE = {
  not_started: 'neutral',
  working: 'brand',
  on_break: 'warning',
  completed: 'success',
  absent: 'danger',
  on_leave: 'info',
} as const

const STATUS_LABEL = {
  not_started: 'Not started',
  working: 'Working',
  on_break: 'On break',
  completed: 'Completed',
  absent: 'Absent',
  on_leave: 'On leave',
} as const

function time(value: string | null): string {
  if (!value) return '—'
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function MyAttendancePage() {
  const { data, isLoading, error, refetch } = useMyAttendanceHistory(30)

  const columns: ReadonlyArray<Column<Attendance>> = [
    {
      id: 'date',
      header: 'Date',
      cell: (row) => (
        <div>
          <p className="font-medium text-ink">
            {new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </p>
          <p className="text-xs text-ink-subtle">
            {new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
          </p>
        </div>
      ),
    },
    { id: 'punch_in', header: 'In', numeric: true, cell: (row) => time(row.punch_in) },
    { id: 'punch_out', header: 'Out', numeric: true, cell: (row) => time(row.punch_out) },
    {
      id: 'break',
      header: 'Break',
      numeric: true,
      cell: (row) => (row.break_minutes > 0 ? `${row.break_minutes}m` : '—'),
    },
    {
      id: 'working_hours',
      header: 'Worked',
      numeric: true,
      cell: (row) => formatHours(row.working_hours),
    },
    {
      id: 'overtime',
      header: 'Overtime',
      numeric: true,
      cell: (row) =>
        row.overtime_hours ? (
          <span className="text-success">{formatHours(row.overtime_hours)}</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          {/* An auto-closed day is a record nobody verified. It must not look
              identical to one the employee closed themselves. */}
          {row.auto_punched_out && (
            <span
              title="You did not punch out — this day was closed automatically and the hours are an estimate."
              className="flex items-center gap-1 rounded-sm border border-warning/25 bg-warning-soft px-1 py-0.5 text-2xs font-medium text-warning"
            >
              <Wand2 className="size-2.5" aria-hidden />
              Auto
            </span>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Daily"
        title="Punch in / out"
        description="Hours, late minutes and overtime are calculated by the database when you punch out — not by this browser."
      />

      <div className="mb-6">
        <PunchCard />
      </div>

      <h3 className="eyebrow mb-3">Last 30 days</h3>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={{
          title: 'No attendance recorded yet',
          description: 'Your first punch in will appear here.',
        }}
      />
    </>
  )
}
