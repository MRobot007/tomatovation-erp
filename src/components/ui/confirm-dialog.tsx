import { useState } from 'react'
import * as AlertDialog from '@radix-ui/react-alert-dialog'
import { Button } from './button'
import { cn } from '@/lib/utils'

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
  onConfirm: () => void | Promise<void>
}

/**
 * The spec requires a confirm step on every destructive action. Built on
 * AlertDialog rather than Dialog so it traps focus, blocks outside dismissal,
 * and announces as an alert — an accidental Escape should not count as consent.
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  onConfirm,
}: ConfirmDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<unknown>(null)

  async function handleConfirm() {
    setPending(true)
    setError(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (caught) {
      // Keep the dialog open on failure. Closing it would leave the user
      // believing the action succeeded.
      setError(caught)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog.Root open={open} onOpenChange={onOpenChange}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in" />
        <AlertDialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-50 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2',
            'rounded-lg border border-line bg-surface p-5 shadow-lg',
            'data-[state=open]:animate-rise-in',
          )}
        >
          <AlertDialog.Title className="font-display text-lg font-semibold tracking-tight text-ink">
            {title}
          </AlertDialog.Title>
          {description && (
            <AlertDialog.Description className="mt-1.5 text-base text-ink-muted">
              {description}
            </AlertDialog.Description>
          )}

          {error != null && (
            <p role="alert" className="mt-3 rounded border border-danger/25 bg-danger-soft px-3 py-2 text-sm text-danger">
              {error instanceof Error ? error.message : String(error)}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <AlertDialog.Cancel asChild>
              <Button variant="ghost" disabled={pending}>
                {cancelLabel}
              </Button>
            </AlertDialog.Cancel>
            <Button
              variant={destructive ? 'danger' : 'primary'}
              loading={pending}
              onClick={handleConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
