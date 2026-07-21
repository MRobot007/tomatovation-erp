import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  ClipboardList,
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
import { useLeadAccess } from '@/features/leads/hooks/use-lead-access'
import { ROLE_LABELS, atLeast } from '@/lib/roles'
import { cn } from '@/lib/utils'

export function DashboardPage() {
  const { profile, role, user } = useAuth()
  const { data: todayDate } = useTodayDate()
  const { data: stats, isLoading } = useDashboardStats(todayDate)
  const { data: myTasks } = useTasks({ assignedTo: user?.id, status: 'all' })

  const { canAccessLeads } = useLeadAccess()

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
        actions={
          <span className="flex items-center gap-2 text-md text-ink-muted">
            <CalendarDays className="size-4 text-ink-subtle" aria-hidden />
            {new Date().toLocaleDateString(undefined, {
              weekday: 'short',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        }
      />

      {/* The action and the reference sit side by side rather than stacked.
          Punching in is what people came for, so it keeps the width; the
          clocks are a glance, and a glance does not need half the page.
          items-stretch so both panels share a height whatever fills them. */}
      <div className="mb-5 grid items-stretch gap-5 lg:grid-cols-[1.6fr_1fr]">
        <PunchCard />
        <WorldClocks />
      </div>

      {isManager && (
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
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
              /* An empty list is good news here, and a single grey line of text
                 reads like something failed to load. The mark and the second
                 line say "nothing is wrong" without needing to be read. */
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <span
                  className="flex size-16 items-center justify-center rounded-full bg-elevated text-ink-subtle"
                  aria-hidden
                >
                  <ClipboardList className="size-7" />
                </span>
                <div>
                  <p className="text-base font-medium text-ink">
                    Nothing assigned to you right now.
                  </p>
                  <p className="mt-1 text-sm text-ink-muted">Enjoy your free time! 🎉</p>
                </div>
              </div>
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
          {/* Hidden rather than zeroed for anyone outside the pipeline. RLS
              already returns nothing to them, so these would read "Open leads
              0" — which is not a permission message, it is a false statement
              about the business. */}
          {canAccessLeads && (
            <>
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
            </>
          )}
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
  const toneClass = tone === 'brand' ? 'text-brand' : tone === 'warning' ? 'text-warning' : 'text-ink'

  const body = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="eyebrow">{label}</p>
        {/* The icon sits in a recessed chip rather than floating. On a glass
            pane a bare icon reads as debris; a chip makes it a component of
            the card. */}
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-elevated/50 text-ink-subtle">
          <Icon className="size-3.5" aria-hidden />
        </span>
      </div>

      {loading ? (
        <Skeleton className="mt-4 h-10 w-20" />
      ) : (
        <p
          className={cn(
            // Bigger and tighter than it was. A metric card exists so the
            // number can be read across a room, and 3xl at default tracking
            // was competing with the label rather than dominating it.
            'mt-3.5 font-display text-4xl font-semibold leading-none tracking-tighter',
            toneClass,
          )}
          data-numeric
        >
          {value ?? 0}
          {of != null && (
            <span className="ml-1 align-baseline text-xl font-medium tracking-normal text-ink-subtle">
              /{of}
            </span>
          )}
        </p>
      )}
    </CardContent>
  )

  if (!to) return <Card>{body}</Card>

  return (
    <Card interactive>
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
    <Card interactive>
      <Link to={to} className="flex items-center gap-3 px-4 py-3.5">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-elevated/50 text-ink-subtle">
          <Icon className="size-3.5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">{label}</span>
        {loading ? (
          <Skeleton className="h-6 w-8" />
        ) : (
          <span
            className={cn('font-display text-xl font-semibold tracking-tight', toneClass)}
            data-numeric
          >
            {value ?? 0}
          </span>
        )}
      </Link>
    </Card>
  )
}
