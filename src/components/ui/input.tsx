import * as React from 'react'
import { cn } from '@/lib/utils'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

/**
 * Inputs sit *inset* against the page — a sunken well rather than an outlined
 * box. On warm paper that reads as a place to write, and it separates fields
 * from buttons without needing heavier borders.
 */
const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type, ...props }, ref) => (
  <input
    type={type}
    ref={ref}
    className={cn(
      'flex h-9 w-full rounded border border-line-strong bg-sunken/50 px-2.5 py-1 text-base text-ink',
      'shadow-[inset_0_1px_2px_hsl(var(--shadow-color)/0.06)] transition-colors duration-150',
      'placeholder:text-ink-subtle',
      'hover:border-ink-subtle/60',
      'focus:border-tomato focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tomato/25 focus:ring-offset-0',
      'disabled:cursor-not-allowed disabled:opacity-50',
      // Tomato (focus) and danger (error) sit only a few degrees apart, so a
      // focused field would otherwise read as a broken one. The tinted fill
      // is what separates them at a glance, before the message is read.
      'aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft aria-[invalid=true]:ring-danger/25',
      'file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-ink',
      className,
    )}
    {...props}
  />
))
Input.displayName = 'Input'

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-20 w-full rounded border border-line-strong bg-sunken/50 px-2.5 py-2 text-base text-ink',
        'shadow-[inset_0_1px_2px_hsl(var(--shadow-color)/0.06)] transition-colors duration-150',
        'placeholder:text-ink-subtle',
        'hover:border-ink-subtle/60',
        'focus:border-tomato focus:bg-surface focus:outline-none focus:ring-2 focus:ring-tomato/25',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-[invalid=true]:border-danger aria-[invalid=true]:bg-danger-soft aria-[invalid=true]:ring-danger/25',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export { Input, Textarea }
