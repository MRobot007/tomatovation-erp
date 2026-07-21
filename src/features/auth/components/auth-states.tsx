import { Loader2, UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { signOut } from '../api/auth.api'

/**
 * Shown while the session check and first profile fetch settle. Deliberately
 * minimal: a skeleton of the shell would flash a layout the user may not be
 * allowed to see.
 */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper" role="status">
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex size-9 items-center justify-center rounded bg-brand font-display text-lg font-bold text-primary-foreground shadow-sm"
          aria-hidden
        >
          T
        </div>
        <Loader2 className="size-4 animate-spin text-ink-subtle" aria-hidden />
        <span className="sr-only">Loading your account</span>
      </div>
    </div>
  )
}

/**
 * Authenticated but with no profiles row. Usually the handle_new_user trigger
 * racing a fresh signup, occasionally a genuinely broken account — so this
 * offers both a retry and a way out, instead of trapping the user.
 */
export function ProfileMissing({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message = error instanceof Error ? error.message : null

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-lg border border-warning/25 bg-warning-soft text-warning">
        <UserX className="size-5" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Your profile is still being set up
      </h1>
      <p className="mt-2 max-w-md text-md text-ink-muted">
        You are signed in, but your employee record has not appeared yet. This usually resolves in a
        second or two right after signing up for the first time.
      </p>
      {message && (
        <p className="mt-3 max-w-md break-words font-mono text-xs text-ink-subtle">{message}</p>
      )}
      <div className="mt-6 flex items-center gap-2">
        <Button variant="primary" onClick={onRetry}>
          Check again
        </Button>
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out
        </Button>
      </div>
    </div>
  )
}
