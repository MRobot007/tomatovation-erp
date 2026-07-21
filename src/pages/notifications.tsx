import { Link } from 'react-router-dom'
import { Bell, CheckCheck, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState, ErrorState } from '@/components/ui/states'
import {
  NOTIFICATION_ICONS,
  timeAgo,
} from '@/features/notifications/components/notification-bell'
import {
  useDeleteNotification,
  useMarkAllAsRead,
  useMarkAsRead,
  useNotifications,
  useUnreadCount,
} from '@/features/notifications/hooks/use-notifications'
import { useSearchParamState } from '@/hooks/use-search-param-state'
import { cn } from '@/lib/utils'

export function NotificationsPage() {
  const [filter, setFilter] = useSearchParamState('filter', 'all')
  const { data: notifications, isLoading, error, refetch } = useNotifications(100)
  const { data: unread = 0 } = useUnreadCount()
  const markAsRead = useMarkAsRead()
  const markAllAsRead = useMarkAllAsRead()
  const remove = useDeleteNotification()

  const visible = notifications?.filter((n) => (filter === 'unread' ? !n.read : true))

  return (
    <>
      <PageHeader
        eyebrow="Workspace"
        title="Notifications"
        description="Task assignments, leave decisions, follow-ups and announcements — delivered as they happen."
        actions={
          unread > 0 && (
            <Button variant="outline" onClick={() => markAllAsRead.mutate()}>
              <CheckCheck aria-hidden />
              Mark all read
            </Button>
          )
        }
      />

      <div className="mb-4 inline-flex rounded border border-line bg-elevated p-0.5" role="tablist">
        {(
          [
            ['all', 'All'],
            ['unread', `Unread${unread > 0 ? ` (${unread})` : ''}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={
              filter === value
                ? 'rounded-sm bg-surface px-3 py-1 text-sm font-medium text-ink shadow-sm'
                : 'rounded-sm px-3 py-1 text-sm text-ink-muted hover:text-ink'
            }
          >
            {label}
          </button>
        ))}
      </div>

      {error && <ErrorState error={error} onRetry={refetch} />}

      {isLoading && (
        <Card>
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="flex gap-3 p-4">
                <Skeleton className="size-8 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-1/3" />
                  <Skeleton className="h-3 w-2/3" />
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {visible && visible.length === 0 && (
        <Card>
          <EmptyState
            icon={Bell}
            title={filter === 'unread' ? 'Nothing unread' : 'No notifications yet'}
            description={
              filter === 'unread'
                ? 'You are all caught up.'
                : 'Task assignments, leave decisions and follow-up reminders will appear here.'
            }
          />
        </Card>
      )}

      {visible && visible.length > 0 && (
        <Card>
          <ul className="divide-y divide-line">
            {visible.map((notification) => {
              const Icon = NOTIFICATION_ICONS[notification.type] ?? Bell

              const body = (
                <div className="flex gap-3 p-4">
                  <span
                    className={cn(
                      'flex size-8 shrink-0 items-center justify-center rounded border',
                      notification.read
                        ? 'border-line bg-elevated text-ink-subtle'
                        : 'border-brand/25 bg-brand-soft text-brand',
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <p
                        className={cn(
                          'text-md',
                          notification.read ? 'text-ink-muted' : 'font-medium text-ink',
                        )}
                      >
                        {notification.title}
                      </p>
                      <span className="shrink-0 font-mono text-xs text-ink-subtle">
                        {timeAgo(notification.created_at)}
                      </span>
                    </div>
                    {notification.message && (
                      <p className="mt-0.5 text-sm text-ink-muted">{notification.message}</p>
                    )}
                    {!notification.read && (
                      <Badge tone="brand" className="mt-1.5">
                        New
                      </Badge>
                    )}
                  </div>
                </div>
              )

              return (
                <li key={notification.id} className="group relative">
                  {notification.link ? (
                    <Link
                      to={notification.link}
                      onClick={() => !notification.read && markAsRead.mutate(notification.id)}
                      className="block transition-colors hover:bg-elevated/50"
                    >
                      {body}
                    </Link>
                  ) : (
                    <button
                      onClick={() => !notification.read && markAsRead.mutate(notification.id)}
                      className="block w-full text-left transition-colors hover:bg-elevated/50"
                    >
                      {body}
                    </button>
                  )}

                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete notification"
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100"
                    onClick={() => remove.mutate(notification.id)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </>
  )
}
