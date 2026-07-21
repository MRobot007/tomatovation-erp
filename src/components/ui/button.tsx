import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Buttons carry a 1px translate on :active — a physical press rather than a
 * colour swap. Primary gets a subtle inner highlight so it reads as a raised
 * surface against warm paper instead of a flat rectangle.
 */
const buttonVariants = cva(
  'inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded font-medium transition-all duration-150 ease-out-expo disabled:pointer-events-none disabled:opacity-45 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-px',
  {
    variants: {
      variant: {
        primary:
          'bg-brand text-primary-foreground shadow-sm hover:bg-brand-hover shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.16)]',
        secondary: 'bg-elevated text-ink hover:bg-sunken border border-line',
        outline: 'border border-line-strong bg-surface text-ink hover:bg-elevated hover:border-ink-subtle',
        ghost: 'text-ink-muted hover:bg-elevated hover:text-ink',
        danger:
          'bg-danger text-destructive-foreground shadow-sm hover:brightness-110 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.16)]',
        link: 'text-brand underline-offset-4 hover:underline active:translate-y-0',
      },
      size: {
        sm: 'h-7 px-2.5 text-xs [&_svg]:size-3.5',
        md: 'h-9 px-3.5 text-base [&_svg]:size-4',
        lg: 'h-10 px-5 text-md [&_svg]:size-4',
        icon: 'h-9 w-9 [&_svg]:size-4',
        'icon-sm': 'h-7 w-7 [&_svg]:size-3.5',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading ? (
          <>
            <Loader2 className="animate-spin" aria-hidden />
            {children}
          </>
        ) : (
          children
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
