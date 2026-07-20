import { Search, Wand2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useTeamAttendance, useTodayDate } from '@/features/attendance/hooks/use-attendance'
import type { AttendanceRow } from '@/features/attendance/api/attendance.api'
import { useSearchParamState } from '@/hooks/use-search-param-state'
import { useDebounced } from '@/hooks/use-debounced'
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

/**
 * Scope is decided by RLS, not by this component: a manager receives their
 * direct reports, a super admin receives everyone. There is no role branch here
 * — the same query returns a different set depending on who asks.
 */
export function TeamAttendancePage() {
  const { data: todayDate } = useTodayDate()
  const [date, setDate] = useSearchParamState('date', '')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const [search, setSearch] = useSearchParamState('q', '')
  const debouncedSearch = useDebounced(search, 300)

  const effectiveDate = date || todayDate || ''

  const { data, isLoading, error, refetch } = useTeamAttendance({
    date: effectiveDate,
    status: status as never,
    search: debouncedSearch,
  })

  const present = data?.filter((row) => row.punch_in != null).length ?? 0
  const working = data?.filter((row) => row.status === 'working').length ?? 0
  const late = data?.filter((row) => (row.late_minutes ?? 0) > 0).length ?? 0
  const completed = data?.filter((row) => row.status === 'completed').length ?? 0

  const columns: ReadonlyArray<Column<AttendanceRow>> = [
    {
      id: 'employee',
      header: 'Employee',
      cell: (row) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <UserAvatar name={row.employee?.name} src={row.employee?.profile_photo} size="sm" />
          <div className="min-w-0">
            <p className="truncate font-medium text-ink">{row.employee?.name ?? 'Unknown'}</p>
            {row.employee?.department && (
              <p className="truncate text-xs text-ink-subtle">{row.employee.department}</p>
            )}
          </div>
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
      id: 'late_minutes',
      header: 'Late',
      numeric: true,
      cell: (row) =>
        row.late_minutes ? (
          <span className="text-warning">{row.late_minutes}m</span>
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    {
      id: 'status',
      header: 'Status',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[row.status]} dot={row.status === 'working'}>
            {STATUS_LABEL[row.status]}
          </Badge>
          {/* Flags a day nobody verified. A manager reviewing hours needs to
              see which ones are estimates before approving anything from them. */}
          {row.auto_punched_out && (
            <span
              title="Closed automatically at midnight — the employee did not punch out, so these hours are an estimate."
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
        title="Attendance"
        description="You see the people who report to you. Super admins see everyone."
      />

      <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Punched in" value={present} />
        <Metric label="Currently working" value={working} tone="brand" />
        <Metric label="Late arrivals" value={late} tone={late > 0 ? 'warning' : undefined} />
        <Metric label="Day completed" value={completed} tone="success" />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          type="date"
          value={effectiveDate}
          onChange={(event) => setDate(event.target.value)}
          className="w-auto"
          aria-label="Date"
          max={todayDate}
        />

        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by name"
            className="pl-8"
            aria-label="Search employees"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-auto min-w-36" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        empty={{
          title: 'No attendance for this day',
          description:
            'Either nobody has punched in yet, or nobody reports to you. Reporting lines are set on the Employees screen.',
        }}
      />
    </>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: 'brand' | 'warning' | 'success'
}) {
  const toneClass =
    tone === 'brand'
      ? 'text-tomato'
      : tone === 'warning'
        ? 'text-warning'
        : tone === 'success'
          ? 'text-success'
          : 'text-ink'

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
