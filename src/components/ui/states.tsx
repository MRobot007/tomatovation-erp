import * as React from 'react'
import { AlertTriangle, RefreshCw, type LucideIcon } from 'lucide-react'
import { Button } from './button'
import { cn } from '@/lib/utils'

/**
 * The spec forbids bare spinners: every list owes the user a loading, empty and
 * error state. These are the shared shells so each feature gets all three
 * without re-inventing the layout.
 */

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}

function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      {Icon && (
        <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-line bg-elevated text-ink-subtle">
          <Icon className="size-5" aria-hidden />
        </div>
      )}
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-sm text-sm text-ink-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  error?: unknown
  onRetry?: () => void
  className?: string
}

/**
 * Surfaces the real message where we have one. Hiding it behind "Something went
 * wrong" makes the app unsupportable — an internal tool has no reason to be
 * coy with its own staff.
 */
function ErrorState({ title = 'Could not load this', error, onRetry, className }: ErrorStateProps) {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : null

  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-14 text-center', className)}>
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-danger/25 bg-danger-soft text-danger">
        <AlertTriangle className="size-5" aria-hidden />
      </div>
      <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
      {message && (
        <p className="mt-1.5 max-w-md break-words font-mono text-xs text-ink-muted">{message}</p>
      )}
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  )
}

export { EmptyState, ErrorState }
