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
  gridProps,
  legendProps,
  seriesAnimation,
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
import { cn } from '@/lib/utils'

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

  /**
   * The headline figures.
   *
   * An analytics page without them makes you read a chart to answer "how did
   * we do" — which is the first question and the one a chart is worst at.
   * Every number here is a reduction of data already fetched, so this costs
   * nothing beyond the arithmetic.
   */
  const summary = useMemo(() => {
    const days = attendanceData.length
    const present = attendanceData.reduce((sum, row) => sum + (row.present_count ?? 0), 0)
    const late = attendanceData.reduce((sum, row) => sum + (row.late_count ?? 0), 0)
    const hours = (performance.data ?? []).reduce((sum, row) => sum + (row.total_hours ?? 0), 0)
    const created = leadsData.reduce((sum, row) => sum + (row.created ?? 0), 0)
    const won = leadsData.reduce((sum, row) => sum + (row.won ?? 0), 0)
    const lost = leadsData.reduce((sum, row) => sum + (row.lost ?? 0), 0)
    const closed = won + lost

    return {
      avgPresent: days > 0 ? present / days : 0,
      // Of the attendance recorded, not of the workforce — a rate against
      // headcount would quietly improve every time someone took leave.
      lateRate: present > 0 ? (late / present) * 100 : 0,
      totalHours: hours,
      created,
      // Null, not zero, when nothing closed. A 0% win rate and no closed deals
      // at all are different facts and must not render identically.
      winRate: closed > 0 ? (won / closed) * 100 : null,
      won,
      closed,
    }
  }, [attendanceData, performance.data, leadsData])

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
        <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Average present"
            value={summary.avgPresent.toFixed(1)}
            unit="per day"
            loading={attendance.isLoading}
            index={0}
          />
          <Kpi
            label="Late arrivals"
            value={`${summary.lateRate.toFixed(0)}%`}
            unit="of attendance"
            tone={summary.lateRate > 15 ? 'warning' : undefined}
            loading={attendance.isLoading}
            index={1}
          />
          <Kpi
            label="Hours worked"
            value={Math.round(summary.totalHours).toLocaleString()}
            unit="across the period"
            loading={performance.isLoading}
            index={2}
          />
          <Kpi
            label="Win rate"
            value={summary.winRate == null ? '—' : `${summary.winRate.toFixed(0)}%`}
            unit={
              summary.winRate == null
                ? 'nothing closed yet'
                : `${summary.won} of ${summary.closed} closed`
            }
            tone={summary.winRate != null && summary.winRate >= 50 ? 'success' : undefined}
            loading={dailyLeads.isLoading}
            index={3}
          />
        </div>
      )}

      {!isEmpty && (
        <div className="grid gap-5 xl:grid-cols-2">
          <ChartCard
            index={0}
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
                <CartesianGrid {...gridProps(colors)} />
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
                  {...seriesAnimation(0)}
                />
                <Line
                  type="monotone"
                  dataKey="late_count"
                  name="Late"
                  stroke={colors.warning}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                  {...seriesAnimation(1)}
                />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            index={1}
            title="Working hours trend"
            description="Average hours worked per person per day."
            loading={attendance.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={attendanceData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps(colors)} />
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
                  activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                  {...seriesAnimation(2)}
                />
                <Line
                  type="monotone"
                  dataKey="overtime_hours"
                  name="Overtime"
                  stroke={colors.success}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 2, stroke: colors.surface }}
                  {...seriesAnimation(0)}
                />
                <Legend {...legendProps(colors)} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            index={2}
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
                <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
                <XAxis type="number" allowDecimals={false} {...axisProps(colors)} />
                <YAxis type="category" dataKey="label" width={78} {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                {/* This one carries per-cell colours, so it is not self-closing
                    and needs the animation spread by hand. */}
                <Bar dataKey="lead_count" name="Leads" radius={[0, 3, 3, 0]} {...seriesAnimation(0)}>
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
            index={3}
            title="Leads per day"
            description="Created, won and lost."
            loading={dailyLeads.isLoading}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={leadsData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid {...gridProps(colors)} />
                <XAxis dataKey="label" {...axisProps(colors)} />
                <YAxis allowDecimals={false} {...axisProps(colors)} />
                <Tooltip {...tooltipProps(colors)} />
                <Legend {...legendProps(colors)} />
                <Bar dataKey="created" name="Created" fill={colors.brand} radius={[3, 3, 0, 0]}
                  {...seriesAnimation(1)} />
                <Bar dataKey="won" name="Won" fill={colors.success} radius={[3, 3, 0, 0]}
                  {...seriesAnimation(2)} />
                <Bar dataKey="lost" name="Lost" fill={colors.danger} radius={[3, 3, 0, 0]}
                  {...seriesAnimation(0)} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard
            index={4}
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
                  <CartesianGrid {...gridProps(colors)} />
                  <XAxis dataKey="leave_type" {...axisProps(colors)} />
                  <YAxis allowDecimals={false} {...axisProps(colors)} />
                  <Tooltip {...tooltipProps(colors)} />
                  <Legend {...legendProps(colors)} />
                  <Bar dataKey="approved" name="Approved" stackId="s" fill={colors.success}
                  {...seriesAnimation(1)} />
                  <Bar dataKey="pending" name="Pending" stackId="s" fill={colors.warning}
                  {...seriesAnimation(2)} />
                  <Bar dataKey="rejected" name="Rejected" stackId="s" fill={colors.danger}
                  {...seriesAnimation(0)} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard
            index={5}
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
                  <CartesianGrid {...gridProps(colors)} horizontal={false} vertical />
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
                  {...seriesAnimation(1)}
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

/**
 * A headline figure.
 *
 * The unit line matters as much as the number: "12%" alone is unreadable, and
 * "12% of attendance" cannot be misread as a share of headcount.
 */
function Kpi({
  label,
  value,
  unit,
  tone,
  loading,
  index,
}: {
  label: string
  value: string
  unit: string
  tone?: 'warning' | 'success'
  loading?: boolean
  index: number
}) {
  const toneClass =
    tone === 'warning' ? 'text-warning' : tone === 'success' ? 'text-success' : 'text-ink'

  return (
    <Card className="animate-rise-in" style={{ animationDelay: `${index * 60}ms` }}>
      <CardContent className="p-5">
        <p className="eyebrow">{label}</p>
        {loading ? (
          <Skeleton className="mt-3.5 h-10 w-24" />
        ) : (
          <p
            className={cn(
              'mt-3 font-display text-4xl font-semibold leading-none tracking-tighter',
              toneClass,
            )}
            data-numeric
          >
            {value}
          </p>
        )}
        <p className="mt-2 text-xs text-ink-subtle">{unit}</p>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  description,
  loading,
  index = 0,
  children,
}: {
  title: string
  description: string
  loading?: boolean
  /** Drives the stagger, so the grid resolves in reading order. */
  index?: number
  children: React.ReactNode
}) {
  return (
    <Card className="animate-rise-in" style={{ animationDelay: `${240 + index * 80}ms` }}>
      <CardHeader>
        <CardTitle className="text-lg tracking-tight">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-[260px] w-full" /> : children}
      </CardContent>
    </Card>
  )
}
