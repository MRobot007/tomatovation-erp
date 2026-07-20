import { cn } from '@/lib/utils'

export const PRESENCE_STATUSES = ['online', 'working', 'break', 'offline'] as const
export type PresenceStatus = (typeof PRESENCE_STATUSES)[number]

export const PRESENCE_LABELS: Record<PresenceStatus, string> = {
  online: 'Online',
  working: 'Working',
  break: 'On Break',
  offline: 'Offline',
}

const PRESENCE_COLORS: Record<PresenceStatus, string> = {
  online: 'bg-presence-online',
  working: 'bg-presence-working',
  break: 'bg-presence-break',
  offline: 'bg-presence-offline',
}

/**
 * 'working' gets an expanding ring so an actively-clocked-in person is legible
 * from across a list without reading labels. Everything else stays static —
 * animating all four states would make the roster feel like an alarm panel.
 */
export function PresenceDot({
  status,
  className,
  showLabel = false,
}: {
  status: PresenceStatus
  className?: string
  showLabel?: boolean
}) {
  const dot = (
    <span className={cn('relative flex size-2.5 shrink-0', className)}>
      {status === 'working' && (
        <span
          className={cn('absolute inset-0 animate-pulse-ring rounded-full', PRESENCE_COLORS[status])}
          aria-hidden
        />
      )}
      <span className={cn('relative size-full rounded-full', PRESENCE_COLORS[status])} />
    </span>
  )

  if (!showLabel) return <span title={PRESENCE_LABELS[status]}>{dot}</span>

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
      {dot}
      {PRESENCE_LABELS[status]}
    </span>
  )
}
