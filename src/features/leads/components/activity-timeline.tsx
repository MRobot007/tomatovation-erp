import {
  ArrowRightLeft,
  CalendarClock,
  Mail,
  MessageSquare,
  Phone,
  Users,
  type LucideIcon,
} from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import { Badge } from '@/components/ui/badge'
import type { LeadActivityRow } from '../api/leads.api'
import { ACTIVITY_LABEL, STATUS_LABEL, STATUS_TONE } from '../constants'

const ICONS: Record<string, LucideIcon> = {
  note: MessageSquare,
  call: Phone,
  email: Mail,
  meeting: Users,
  status_change: ArrowRightLeft,
  assignment: Users,
  followup_scheduled: CalendarClock,
}

/** Relative for recent entries, absolute once "3 days ago" stops being useful. */
function when(iso: string): string {
  const date = new Date(iso)
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`
  if (minutes < 10_080) return `${Math.floor(minutes / 1440)}d ago`

  return date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Vertical timeline, newest first. The connecting rule is drawn per item rather
 * than as one absolute line so it stops cleanly at the last entry instead of
 * trailing past it.
 */
export function ActivityTimeline({
  activities,
  isLoading,
}: {
  activities: LeadActivityRow[] | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="flex gap-3">
            <Skeleton className="size-7 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <EmptyState
        icon={MessageSquare}
        title="No activity yet"
        description="Calls, emails, meetings and status changes appear here as they happen."
      />
    )
  }

  return (
    <ol className="relative">
      {activities.map((activity, index) => {
        const Icon = ICONS[activity.activity] ?? MessageSquare
        const isLast = index === activities.length - 1

        return (
          <li key={activity.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span
                className="absolute left-[13px] top-8 h-[calc(100%-2rem)] w-px bg-line"
                aria-hidden
              />
            )}

            <span className="relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-ink-subtle">
              <Icon className="size-3.5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-sm font-medium text-ink">
                  {ACTIVITY_LABEL[activity.activity as keyof typeof ACTIVITY_LABEL] ??
                    activity.activity}
                </span>

                {activity.from_status && activity.to_status && (
                  <span className="flex items-center gap-1.5">
                    <Badge tone={STATUS_TONE[activity.from_status]}>
                      {STATUS_LABEL[activity.from_status]}
                    </Badge>
                    <ArrowRightLeft className="size-2.5 text-ink-subtle" aria-hidden />
                    <Badge tone={STATUS_TONE[activity.to_status]}>
                      {STATUS_LABEL[activity.to_status]}
                    </Badge>
                  </span>
                )}

                <time
                  className="ml-auto shrink-0 font-mono text-xs text-ink-subtle"
                  dateTime={activity.created_at}
                  title={new Date(activity.created_at).toLocaleString()}
                >
                  {when(activity.created_at)}
                </time>
              </div>

              {activity.remarks && (
                <p className="mt-1 whitespace-pre-wrap text-sm text-ink-muted">{activity.remarks}</p>
              )}

              {activity.employee && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  <UserAvatar
                    name={activity.employee.name}
                    src={activity.employee.profile_photo}
                    size="xs"
                  />
                  <span className="text-xs text-ink-subtle">{activity.employee.name}</span>
                </div>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
