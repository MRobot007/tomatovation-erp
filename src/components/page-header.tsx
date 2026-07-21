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
          {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
          {/* -0.03em: Space Grotesk is drawn tight and needs the optical
              correction every geometric face wants as it scales up, or a
              display-size line reads loose next to the body text under it. */}
          <h2 className="font-display text-3xl font-semibold leading-none tracking-[-0.03em] text-ink">
            {title}
          </h2>
          {description && <p className="mt-2.5 max-w-2xl text-md text-ink-muted">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>
      <div className="rule mt-5" />
    </div>
  )
}
