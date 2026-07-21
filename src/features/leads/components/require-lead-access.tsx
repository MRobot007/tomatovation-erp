import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useLeadAccess } from '../hooks/use-lead-access'
import { FullPageLoader } from '@/features/auth/components/auth-states'

/**
 * Keeps people who cannot read the pipeline off the pipeline screens.
 *
 * A convenience, not the boundary — RLS already returns nothing to them, so
 * the worst case without this is an empty table rather than a leak. What it
 * prevents is the confusion of an employee reaching a Leads page that renders
 * "No leads yet" and concluding the company has no customers.
 *
 * Waits for the answer rather than assuming one. Rendering the page and then
 * yanking it, or bouncing to /403 and then back, are both worse than a beat
 * of loading.
 */
export function RequireLeadAccess({ children }: { children: ReactNode }) {
  const { canAccessLeads, isLoading } = useLeadAccess()

  if (isLoading) return <FullPageLoader />
  if (!canAccessLeads) return <Navigate to="/403" replace />

  return <>{children}</>
}
