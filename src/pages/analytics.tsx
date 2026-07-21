import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Download, Printer } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { DateRangePicker, useDateRange } from '@/features/analytics/components/date-range-picker'
import {
  axisProps,
  categoricalPalette,
  chartColors,
  tooltipProps,
} from '@/features/analytics/components/chart-theme'
import {
  useAttendanceSummary,
  useDailyLeads,
  useEmployeePerformance,
  useLeadFunnel,
  useLeaveStats,
} from '@/features/analytics/hooks/use-analytics'
import { STATUS_LABEL } from '@/features/leads/constants'
import { downloadCsv, exportFilename, printSection } from '@/lib/export'

function shortDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  })
}

export function AnalyticsPage() {
  const { from, to, setPreset, preset } = useDateRange()
  const colors = useMemo(chartColors, [])
  const palette = useMemo(categoricalPalette, [])

  const attendance = useAttendanceSummary(from, to)
  const performance = useEmployeePerformance(from, to)
  const funnel = useLeadFunnel(from, to)
  const dailyLeads = useDailyLeads(from, to)
  const leaveStats = useLeaveStats(from, to)

  const attendanceData = (attendance.data ?? []).map((row) => ({
    ...row,
    label: shortDate(row.day),
  }))

  const funnelData = (funnel.data ?? []).map((row) => ({
    ...row,
    label: STATUS_LABEL[row.status],
  }))

  const leadsData = (dailyLeads.data ?? []).map((row) => ({ ...row, label: shortDate(row.day) }))

  const topPerformers = (performance.data ?? []).slice(0, 10)

  const isEmpty =
    !attendance.isLoading &&
    attendanceData.length === 0 &&
    funnelData.every((row) => row.lead_count === 0) &&
    topPerformers.length === 0

  return (
    <div id="analytics-report">
      <PageHeader
        eyebrow="Insight"
        title="Analytics"
        description="Every figure is aggregated by the database, not computed in this browser."
        actions={
          <>
            <DateRangePicker preset={preset} onPresetChange={setPreset} />
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  exportFilename('employee_performance', from, to),
                  performance.data ?? [],
                  [
                    { header: 'Employee', value: (row) => row.employee_name },
                    { header: 'Department', value: (row) => row.department },
                    { header: 'Days present', value: (row) => row.days_present },
                    { header: 'Days late', value: (row) => row.days_late },
                    { header: 'Total hours', value: (row) => row.total_hours },
                    { header: 'Avg hours/day', value: (row) => row.avg_hours },
                    { header: 'Overtime hours', value: (row) => row.overtime_hours },
                    { header: 'Work logs', value: (row) => row.work_log_count },
                    { header: 'Logged hours', value: (row) => row.logged_hours },
                    { header: 'Tasks completed', value: (row) => row.tasks_completed },
                  ],
                )
              }
            >
              <Download aria-hidden />
              Export CSV
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Print report"
              onClick={() => printSection('analytics-report')}
            >
              <Printer aria-hidden />
            </Button>
          </>
        }
      />

      {isEmpty && (
        <Card>
          <EmptyState
            title="No data in this period"
            description="Once your team records attendance, logs work and moves leads, the charts fill in here."
          />
        </Card>
      )}

      {!isEmpty && (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            title="Attendance"
            description="People present each day, and how many arrived late."
            loading={attendance.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={attendanceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="presentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={colors.brand} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={colors.brand} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={colors.line} vertical={false} />
                <XAxis dataKey="label" {...axisProps(colors)} />
                <YAxis allowDecimals={false} {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                <Area
                  type="monotone"
                  dataKey="present_count"
                  name="Present"
                  stroke={colors.brand}
                  strokeWidth={2}
                  fill="url(#presentFill)"
                />
                <Line
                  type="monotone"
                  dataKey="late_count"
                  name="Late"
                  stroke={colors.warning}
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Working hours trend"
            description="Average hours worked per person per day."
            loading={attendance.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={attendanceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={colors.line} vertical={false} />
                <XAxis dataKey="label" {...axisProps(colors)} />
                <YAxis {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                <Line
                  type="monotone"
                  dataKey="avg_hours"
                  name="Avg hours"
                  stroke={colors.info}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="overtime_hours"
                  name="Overtime"
                  stroke={colors.success}
                  strokeWidth={2}
                  dot={false}
                />
                <Legend wrapperStyle={{ fontSize: 12, color: colors.inkMuted }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Lead conversion funnel"
            description="Where leads sit in the pipeline."
            loading={funnel.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={funnelData}
                layout="vertical"
                margin={{ top: 4, right: 16, left: 20, bottom: 0 }}
              >
                <CartesianGrid stroke={colors.line} horizontal={false} />
                <XAxis type="number" allowDecimals={false} {...axisProps(colors)} />
                <YAxis type="category" dataKey="label" width={78} {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                <Bar dataKey="lead_count" name="Leads" radius={[0, 3, 3, 0]}>
                  {funnelData.map((row, index) => (
                    <Cell
                      key={row.status}
                      fill={
                        row.status === 'won'
                          ? colors.success
                          : row.status === 'lost'
                            ? colors.danger
                            : palette[index % palette.length]
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Leads per day"
            description="Created, won and lost."
            loading={dailyLeads.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid stroke={colors.line} vertical={false} />
                <XAxis dataKey="label" {...axisProps(colors)} />
                <YAxis allowDecimals={false} {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                <Legend wrapperStyle={{ fontSize: 12, color: colors.inkMuted }} />
                <Bar dataKey="created" name="Created" fill={colors.brand} radius={[3, 3, 0, 0]} />
                <Bar dataKey="won" name="Won" fill={colors.success} radius={[3, 3, 0, 0]} />
                <Bar dataKey="lost" name="Lost" fill={colors.danger} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            title="Leave by type"
            description="Requests and their outcomes."
            loading={leaveStats.isLoading}
          >
            {(leaveStats.data ?? []).length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-subtle">
                No leave requested in this period.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={leaveStats.data ?? []}
                  margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.line} vertical={false} />
                  <XAxis dataKey="leave_type" {...axisProps(colors)} />
                  <YAxis allowDecimals={false} {...axisProps(colors)} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Legend wrapperStyle={{ fontSize: 12, color: colors.inkMuted }} />
                  <Bar dataKey="approved" name="Approved" stackId="s" fill={colors.success} />
                  <Bar dataKey="pending" name="Pending" stackId="s" fill={colors.warning} />
                  <Bar dataKey="rejected" name="Rejected" stackId="s" fill={colors.danger} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            title="Top performers"
            description="By total hours worked in the period."
            loading={performance.isLoading}
          >
            {topPerformers.length === 0 ? (
              <p className="py-16 text-center text-sm text-ink-subtle">No attendance recorded.</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={topPerformers}
                  layout="vertical"
                  margin={{ top: 4, right: 16, left: 20, bottom: 0 }}
                >
                  <CartesianGrid stroke={colors.line} horizontal={false} />
                  <XAxis type="number" {...axisProps(colors)} />
                  <YAxis
                    type="category"
                    dataKey="employee_name"
                    width={96}
                    {...axisProps(colors)}
                  />
                  <Tooltip {...tooltipProps(colors)} />
                  <Bar
                    dataKey="total_hours"
                    name="Hours"
                    fill={colors.brand}
                    radius={[0, 3, 3, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>
      )}
    </div>
  )
}

function ChartCard({
  title,
  description,
  loading,
  children,
}: {
  title: string
  description: string
  loading?: boolean
  children: React.ReactNode
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[260px] w-full" /> : children}
      </CardContent>
    </Card>
  )
}
