import { UserX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { logoLockup, LOGO_MARK_ASPECT } from '@/lib/logo'
import { signOut } from '../api/auth.api'

/**
 * Shown while the session check and first profile fetch settle. Deliberately
 * minimal: a skeleton of the shell would flash a layout the user may not be
 * allowed to see.
 */
export function FullPageLoader() {
  return (
    <div
      className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-paper"
      role="status"
    >
      {/* A whisper of tone from the top-left and a soft floor, so the white is
          not a flat void behind the mark. */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(60% 45% at 15% 0%, hsl(220 14% 96% / 0.9) 0%, transparent 60%), radial-gradient(70% 50% at 50% 100%, hsl(220 12% 95% / 0.6) 0%, transparent 70%)',
        }}
        aria-hidden
      />

      <div className="relative flex flex-col items-center gap-6 animate-fade-in">
        {/* The white mark on a machined-dark chip — the same material as the
            rail, and the one surface the white logo can sit on. It breathes
            gently rather than spinning; a spinner reads as "busy", a breath
            reads as "starting up". */}
        <div className="relative animate-logo-breathe">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-b from-[hsl(220_9%_18%)] to-[hsl(220_14%_7%)] shadow-[0_12px_32px_-12px_hsl(220_30%_10%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.07)]">
            <div className="h-7 overflow-hidden" style={{ aspectRatio: LOGO_MARK_ASPECT }}>
              <img src={logoLockup} alt="" className="block w-full select-none" draggable={false} />
            </div>
          </div>
          <span
            className="pointer-events-none absolute -inset-3 -z-10 rounded-[1.5rem] bg-ink/[0.06] blur-2xl"
            aria-hidden
          />
        </div>

        {/* Indeterminate rail: a short bar sweeping a hairline track. Calmer and
            more finished than a spinning ring. */}
        <div className="relative h-[3px] w-28 overflow-hidden rounded-full bg-line">
          <span
            className="absolute inset-y-0 left-0 w-1/3 rounded-full bg-ink/70 animate-loader-slide"
            aria-hidden
          />
        </div>

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
