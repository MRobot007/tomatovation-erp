import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface PageHeaderProps {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
  className?: string
}

/**
 * Every page opens the same way: a tracked-out eyebrow, a display-cut title, an
 * optional line of context, and right-aligned actions — then a rule. That
 * repetition is what makes 20 screens feel like one product.
 */
export function PageHeader({ eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('mb-6', className)}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="eyebrow mb-1.5">{eyebrow}</p>}
          <h2 className="font-display text-2xl font-semibold leading-none tracking-tight text-ink">
            {title}
          </h2>
          {description && <p className="mt-2 max-w-2xl text-md text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="rule mt-5" />
    </div>
  )
}
