import { Navigate, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../auth-context'
import { hasRole, type Role } from '@/lib/roles'
import { FullPageLoader, ProfileMissing } from './auth-states'

interface ProtectedRouteProps {
  children: ReactNode
  /** Omit to allow any authenticated role. */
  allowedRoles?: readonly Role[]
}

/**
 * A convenience guard, not the security boundary — RLS is. Its job is to keep
 * people out of screens that would only show them empty tables anyway, and to
 * send them somewhere useful instead of a blank page.
 */
export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, profile, role, loading, profileError, refetchProfile } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />

  if (!session) {
    // Remember where they were headed so login can return them there rather
    // than always dumping them on the dashboard.
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  // Authenticated, but no profile row. Distinct from "not logged in" and needs
  // a different remedy, so it gets its own screen rather than a redirect loop.
  if (!profile) {
    return <ProfileMissing error={profileError} onRetry={refetchProfile} />
  }

  if (profile.status !== 'active') {
    return <AccountInactive status={profile.status} />
  }

  if (allowedRoles && !hasRole(role, allowedRoles)) {
    return <Navigate to="/403" replace />
  }

  return <>{children}</>
}

/** Inverse guard: keeps a signed-in user off the login and signup screens. */
export function PublicOnlyRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullPageLoader />

  if (session) {
    // "/" rather than a fixed screen — the index route picks by role.
    const from = (location.state as { from?: Location } | null)?.from
    return <Navigate to={from?.pathname ?? '/'} replace />
  }

  return <>{children}</>
}

function AccountInactive({ status }: { status: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-paper px-6 text-center">
      <p className="eyebrow mb-2">Account {status}</p>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Your account is not active
      </h1>
      <p className="mt-2 max-w-md text-md text-ink-muted">
        Sign-in is disabled while your account is marked <strong>{status}</strong>. Contact a super
        admin to have it reactivated.
      </p>
    </div>
  )
}
