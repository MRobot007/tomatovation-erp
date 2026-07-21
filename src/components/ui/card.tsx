import * as React from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Opt in for cards that DO something when clicked — they lift, brighten
   * their border and catch a hairline of light along the top edge.
   *
   * Deliberately opt-in rather than automatic. If every card responds to the
   * pointer, the response stops meaning "this is a control" and becomes
   * ambient noise on a screen that already has fifteen of them.
   */
  interactive?: boolean
  /**
   * Force the "black morphism" treatment — a smoked dark frosted pane that
   * stays dark in BOTH themes, rather than the default card which is white in
   * light mode. Its own content (text, dividers, chips) flips to read on dark
   * automatically, so nothing inside needs per-element colours.
   *
   * For a deliberate feature panel that should stand out against the paper —
   * not something to reach for on every card, or the contrast the treatment
   * buys is spent.
   */
  dark?: boolean
}

const Card = React.forwardRef<HTMLDivElement, CardProps>(
  ({ className, interactive, dark, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        // The glass class carries its own border, fill and bevel, so no
        // bg-surface or border-line here — they would paint over the pane and
        // it would go back to being a rectangle.
        'relative overflow-hidden rounded-lg',
        dark ? 'glass-dark' : 'glass',
        interactive && 'card-interactive',
        className,
      )}
      {...props}
    />
  ),
)
Card.displayName = 'Card'

const CardHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex flex-col gap-1 px-5 pb-3 pt-4', className)} {...props} />
  ),
)
CardHeader.displayName = 'CardHeader'

const CardTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn('font-display text-lg font-semibold leading-tight tracking-tight', className)}
      {...props}
    />
  ),
)
CardTitle.displayName = 'CardTitle'

const CardDescription = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn('text-sm text-ink-muted', className)} {...props} />
  ),
)
CardDescription.displayName = 'CardDescription'

const CardContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('px-5 pb-5', className)} {...props} />,
)
CardContent.displayName = 'CardContent'

const CardFooter = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center gap-2 border-t border-line bg-elevated/40 px-5 py-3', className)}
      {...props}
    />
  ),
)
CardFooter.displayName = 'CardFooter'

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter }
