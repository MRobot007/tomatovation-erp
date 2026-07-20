import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ListChecks,
  Target,
  Timer,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { PunchCard } from '@/features/attendance/components/punch-card'
import { AttentionPanel } from '@/features/tasks/components/attention-panel'
import { WorldClocks } from '@/features/dashboard/components/world-clocks'
import { useTodayDate } from '@/features/attendance/hooks/use-attendance'
import { useDashboardStats } from '@/features/analytics/hooks/use-analytics'
import { useTasks } from '@/features/tasks/hooks/use-tasks'
import { useAuth } from '@/features/auth/auth-context'
import { ROLE_LABELS, atLeast } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { profile, role, user } = useAuth()
  const { data: todayDate } = useTodayDate()
  const { data: stats, isLoading } = useDashboardStats(todayDate)
  const { data: myTasks } = useTasks({ assignedTo: user?.id, status: 'all' })

  const isManager = atLeast(role, 'manager')

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = profile?.name.split(' ')[0] ?? ''

  const openTasks = (myTasks ?? []).filter(
    (task) => task.status !== 'done' && task.status !== 'cancelled',
  )
  const dueToday = openTasks.filter(
    (task) => task.deadline && new Date(task.deadline).toDateString() === new Date().toDateString(),
  )

  return (
    <>
      <PageHeader
        eyebrow={role ? ROLE_LABELS[role] : undefined}
        title={`${greeting}, ${firstName}`}
        description="Your day at a glance."
      />

      {/* Above the punch card: it is reference information, not an action, and
          the primary action on this page should stay the most prominent thing. */}
      <div className="mb-5">
        <WorldClocks />
      </div>

      <div className="mb-6">
        <PunchCard />
      </div>

      {isManager && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="Present today"
            value={stats?.present_today}
            of={stats?.active_employees}
            icon={CalendarCheck}
            loading={isLoading}
            to="/attendance"
          />
          <Metric
            label="Working now"
            value={stats?.working_now}
            icon={Timer}
            loading={isLoading}
            tone="brand"
            to="/live"
          />
          <Metric
            label="Late today"
            value={stats?.late_today}
            icon={AlertTriangle}
            loading={isLoading}
            tone={stats && stats.late_today > 0 ? 'warning' : undefined}
            to="/attendance"
          />
          <Metric
            label="On leave"
            value={stats?.on_leave_today}
            icon={CalendarDays}
            loading={isLoading}
            to="/leaves"
          />
        </div>
      )}

      {isManager && (
        <div className="mb-5">
          <AttentionPanel />
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <Card>
          <CardContent className="pt-5">
            <div className="mb-3 flex items-baseline justify-between">
              <p className="eyebrow">Today's tasks</p>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link to="/tasks">
                  All tasks <ArrowRight className="size-3" aria-hidden />
                </Link>
              </Button>
            </div>

            {openTasks.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-subtle">
                Nothing assigned to you right now.
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {openTasks.slice(0, 6).map((task) => {
                  const overdue = task.deadline != null && new Date(task.deadline) < new Date()
                  return (
                    <li key={task.id} className="flex items-center gap-2.5 py-2">
                      <span
                        className={cn(
                          'size-1.5 shrink-0 rounded-full',
                          task.priority === 'urgent'
                            ? 'bg-danger'
                            : task.priority === 'high'
                              ? 'bg-warning'
                              : 'bg-line-strong',
                        )}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-base text-ink">{task.title}</span>
                      {task.deadline && (
                        <span
                          className={cn(
                            'shrink-0 font-mono text-xs',
                            overdue ? 'text-danger' : 'text-ink-subtle',
                          )}
                        >
                          {new Date(task.deadline).toLocaleDateString(undefined, {
                            day: 'numeric',
                            month: 'short',
                          })}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {dueToday.length > 0 && (
              <p className="mt-3 rounded border border-warning/25 bg-warning-soft px-2.5 py-1.5 text-xs text-warning">
                {dueToday.length} due today
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          <QuickStat
            label="Open leads"
            value={stats?.open_leads}
            loading={isLoading}
            icon={Target}
            to="/leads"
          />
          <QuickStat
            label="Follow-ups due"
            value={stats?.followups_due}
            loading={isLoading}
            icon={CalendarClock}
            to="/leads"
            tone={stats && stats.followups_due > 0 ? 'warning' : undefined}
          />
          <QuickStat
            label="Overdue tasks"
            value={stats?.overdue_tasks}
            loading={isLoading}
            icon={ListChecks}
            to="/tasks"
            tone={stats && stats.overdue_tasks > 0 ? 'danger' : undefined}
          />
          {isManager && (
            <QuickStat
              label="Leave awaiting approval"
              value={stats?.pending_leaves}
              loading={isLoading}
              icon={Users}
              to="/leaves?scope=team&status=pending"
              tone={stats && stats.pending_leaves > 0 ? 'warning' : undefined}
            />
          )}
        </div>
      </div>
    </>
  )
}

function Metric({
  label,
  value,
  of,
  icon: Icon,
  loading,
  tone,
  to,
}: {
  label: string
  value: number | undefined
  of?: number
  icon: LucideIcon
  loading?: boolean
  tone?: 'brand' | 'warning'
  to?: string
}) {
  const toneClass = tone === 'brand' ? 'text-tomato' : tone === 'warning' ? 'text-warning' : 'text-ink'

  const body = (
    <CardContent className="pt-5">
      <div className="flex items-start justify-between">
        <p className="eyebrow">{label}</p>
        <Icon className="size-4 text-ink-subtle" aria-hidden />
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-8 w-16" />
      ) : (
        <p
          className={cn(
            'mt-2 font-display text-3xl font-semibold leading-none tracking-tight',
            toneClass,
          )}
          data-numeric
        >
          {value ?? 0}
          {of != null && <span className="text-lg text-ink-subtle"> / {of}</span>}
        </p>
      )}
    </CardContent>
  )

  if (!to) return <Card>{body}</Card>

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link to={to} className="block">
        {body}
      </Link>
    </Card>
  )
}

function QuickStat({
  label,
  value,
  loading,
  icon: Icon,
  to,
  tone,
}: {
  label: string
  value: number | undefined
  loading?: boolean
  icon: LucideIcon
  to: string
  tone?: 'warning' | 'danger'
}) {
  const toneClass = tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-ink'

  return (
    <Card className="transition-shadow hover:shadow-md">
      <Link to={to} className="flex items-center gap-3 px-5 py-4">
        <Icon className="size-4 shrink-0 text-ink-subtle" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{label}</span>
        {loading ? (
          <Skeleton className="h-5 w-8" />
        ) : (
          <span className={cn('font-display text-xl font-semibold', toneClass)} data-numeric>
            {value ?? 0}
          </span>
        )}
      </Link>
    </Card>
  )
}
