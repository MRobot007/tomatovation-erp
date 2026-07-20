import { useId, type ReactNode } from 'react'
import type { FieldError } from 'react-hook-form'
import { Label } from './label'
import { cn } from '@/lib/utils'

interface FormFieldProps {
  label: string
  error?: FieldError | undefined
  hint?: string
  required?: boolean
  className?: string
  /** Receives the id and aria wiring to spread onto the control. */
  children: (props: {
    id: string
    'aria-invalid': boolean
    'aria-describedby': string | undefined
  }) => ReactNode
}

/**
 * Wires label, control, hint and error message together with the right aria
 * attributes. Doing this by hand at every field is where accessibility quietly
 * rots — one forgotten aria-describedby and a screen reader never announces
 * the validation message.
 */
export function FormField({
  label,
  error,
  hint,
  required,
  className,
  children,
}: FormFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`
  const describedBy = error ? errorId : hint ? hintId : undefined

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={id} required={required}>
        {label}
      </Label>

      {children({ id, 'aria-invalid': Boolean(error), 'aria-describedby': describedBy })}

      {error ? (
        <p id={errorId} role="alert" className="text-xs text-danger">
          {error.message}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** Form-level error banner, for failures that belong to no single field. */
export function FormError({ error }: { error: unknown }) {
  if (!error) return null
  const message = error instanceof Error ? error.message : String(error)

  return (
    <div
      role="alert"
      className="rounded border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger"
    >
      {message}
    </div>
  )
}
