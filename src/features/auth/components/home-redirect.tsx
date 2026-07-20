import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth-context'
import { atLeast } from '@/lib/roles'

/**
 * Where signing in actually lands you, decided by role.
 *
 * An employee's first act of the day is punching in, so that is the screen they
 * get. Making them pass through a dashboard first adds a click to the one thing
 * they open the app to do.
 *
 * Managers and super admins land on the dashboard, where their team's presence,
 * blocked tasks and pending approvals are.
 *
 * The dashboard stays reachable from the sidebar for everyone — this changes
 * the default, it does not take a screen away.
 */
export function HomeRedirect() {
  const { role } = useAuth()

  // ProtectedRoute resolves the profile before this renders, so role is set.
  // atLeast() treats a null role as not-a-manager, which lands on the punch
  // screen — the safer of the two if that ever stops holding.
  return <Navigate to={atLeast(role, 'manager') ? '/dashboard' : '/attendance/me'} replace />
}
