import { Link } from 'react-router-dom'
import {
  Bell,
  CalendarCheck,
  CalendarClock,
  CheckCheck,
  ListChecks,
  Megaphone,
  NotebookPen,
  Target,
  Timer,
  type LucideIcon,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useUnreadCount,
} from '../hooks/use-notifications'
import type { Notification, NotificationType } from '../api/notifications.api'
import { cn } from '@/lib/utils'

export const NOTIFICATION_ICONS: Record<NotificationType, LucideIcon> = {
  task_assigned: ListChecks,
  leave_approved: CalendarCheck,
  leave_rejected: CalendarCheck,
  leave_requested: CalendarCheck,
  followup_due: CalendarClock,
  punch_out_reminder: Timer,
  announcement: Megaphone,
  work_log_reviewed: NotebookPen,
  lead_assigned: Target,
  task_status_changed: ListChecks,
}

export function timeAgo(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m`
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`
  if (minutes < 10_080) return `${Math.floor(minutes / 1440)}d`
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function NotificationBell() {
  const { data: unread = 0 } = useUnreadCount()
  const { data: notifications, isLoading } = useNotifications(10)
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span
              className={cn(
                'absolute -right-0.5 -top-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full',
                'bg-tomato px-1 font-mono text-[9px] font-bold leading-none text-primary-foreground',
                'ring-2 ring-surface',
              )}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-sm font-medium text-ink">Notifications</p>
          {unread > 0 && (
            <button
              onClick={() => markAllAsRead.mutate()}
              className="flex items-center gap-1 text-xs text-ink-muted transition-colors hover:text-tomato"
            >
              <CheckCheck className="size-3" aria-hidden />
              Mark all read
            </button>
          )}
        </div>

        <DropdownMenuSeparator className="mx-0" />

        <div className="max-h-80 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="flex gap-2">
                  <Skeleton className="size-6 rounded" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-2/3" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : !notifications || notifications.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-ink-subtle">
              Nothing yet. Task assignments, leave decisions and follow-ups land here.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={() => markAsRead.mutate(notification.id)}
                />
              ))}
            </ul>
          )}
        </div>

        <DropdownMenuSeparator className="mx-0" />

        <Link
          to="/notifications"
          className="block px-3 py-2 text-center text-sm text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
        >
          See all
        </Link>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification
  onRead: () => void
}) {
  const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell

  const content = (
    <div className={cn('flex gap-2.5 px-3 py-2.5', !notification.read && 'bg-tomato-soft/40')}>
      <span
        className={cn(
          'mt-0.5 flex size-6 shrink-0 items-center justify-center rounded border',
          notification.read
            ? 'border-line bg-elevated text-ink-subtle'
            : 'border-tomato/25 bg-surface text-tomato',
        )}
      >
        <Icon className="size-3" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'truncate text-sm',
            notification.read ? 'text-ink-muted' : 'font-medium text-ink',
          )}
        >
          {notification.title}
        </p>
        {notification.message && (
          <p className="line-clamp-2 text-xs text-ink-subtle">{notification.message}</p>
        )}
        <p className="mt-0.5 font-mono text-2xs text-ink-subtle">{timeAgo(notification.created_at)}</p>
      </div>

      {!notification.read && (
        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-tomato" aria-label="Unread" />
      )}
    </div>
  )

  return (
    <li>
      {notification.link ? (
        <Link to={notification.link} onClick={onRead} className="block hover:bg-elevated">
          {content}
        </Link>
      ) : (
        <button onClick={onRead} className="block w-full text-left hover:bg-elevated">
          {content}
        </button>
      )}
    </li>
  )
}
