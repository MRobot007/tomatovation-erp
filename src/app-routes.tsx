import { lazy, Suspense, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/components/layout/app-shell'
import { ProtectedRoute, PublicOnlyRoute } from '@/features/auth/components/protected-route'
import { PlaceholderPage } from '@/pages/placeholder-page'
import { ForbiddenPage, NotFoundPage } from '@/pages/forbidden'
import { LoginPage } from '@/pages/auth/login'
import { RouteFallback } from '@/components/route-fallback'
import { NAV_ITEMS } from '@/config/navigation'
import type { Role } from '@/lib/roles'

/**
 * Everything except the login screen is lazily loaded.
 *
 * Login is eager because it is the first paint for a signed-out visitor, and
 * chunking it would only add a round trip before anyone can type. Every other
 * screen is behind auth, so its chunk downloads while the session and profile
 * requests are already in flight.
 */
const SignupPage = lazy(() => import('@/pages/auth/signup').then((m) => ({ default: m.SignupPage })))
const ForgotPasswordPage = lazy(() =>
  import('@/pages/auth/forgot-password').then((m) => ({ default: m.ForgotPasswordPage })),
)
const ResetPasswordPage = lazy(() =>
  import('@/pages/auth/reset-password').then((m) => ({ default: m.ResetPasswordPage })),
)

const DashboardPage = lazy(() => import('@/pages/dashboard').then((m) => ({ default: m.DashboardPage })))
const EmployeesPage = lazy(() => import('@/pages/employees').then((m) => ({ default: m.EmployeesPage })))
const ManagersPage = lazy(() => import('@/pages/managers').then((m) => ({ default: m.ManagersPage })))
const ProfilePage = lazy(() => import('@/pages/profile').then((m) => ({ default: m.ProfilePage })))
const MyAttendancePage = lazy(() =>
  import('@/pages/attendance-me').then((m) => ({ default: m.MyAttendancePage })),
)
const TeamAttendancePage = lazy(() =>
  import('@/pages/attendance').then((m) => ({ default: m.TeamAttendancePage })),
)
const WorkLogsPage = lazy(() => import('@/pages/work-logs').then((m) => ({ default: m.WorkLogsPage })))
const TasksPage = lazy(() => import('@/pages/tasks').then((m) => ({ default: m.TasksPage })))
const LeavesPage = lazy(() => import('@/pages/leaves').then((m) => ({ default: m.LeavesPage })))
const LeadsPage = lazy(() => import('@/pages/leads').then((m) => ({ default: m.LeadsPage })))
const LeadDetailPage = lazy(() =>
  import('@/pages/lead-detail').then((m) => ({ default: m.LeadDetailPage })),
)
const NotificationsPage = lazy(() =>
  import('@/pages/notifications').then((m) => ({ default: m.NotificationsPage })),
)
const LiveBoardPage = lazy(() =>
  import('@/pages/live-board').then((m) => ({ default: m.LiveBoardPage })),
)
const AnnouncementsPage = lazy(() =>
  import('@/pages/announcements').then((m) => ({ default: m.AnnouncementsPage })),
)
const AuditLogsPage = lazy(() =>
  import('@/pages/audit-logs').then((m) => ({ default: m.AuditLogsPage })),
)
const SettingsPage = lazy(() => import('@/pages/settings').then((m) => ({ default: m.SettingsPage })))
// Recharts is the single heaviest dependency in the app and is used by two
// screens. Lazy loading keeps it out of every other route's cost.
const AnalyticsPage = lazy(() =>
  import('@/pages/analytics').then((m) => ({ default: m.AnalyticsPage })),
)
const ReportsPage = lazy(() => import('@/pages/reports').then((m) => ({ default: m.ReportsPage })))
const DesignSystemPage = lazy(() =>
  import('@/pages/design-system').then((m) => ({ default: m.DesignSystemPage })),
)

/**
 * Guard lists are read from NAV_ITEMS, the same array the sidebar renders from.
 * Declaring them twice is how a link ends up visible without a matching guard,
 * or a guard drifts wider than the nav suggests.
 */
function rolesFor(path: string): readonly Role[] {
  const item = NAV_ITEMS.find((entry) => entry.to === path)
  if (!item) throw new Error(`No nav entry for protected route "${path}" — add it to navigation.ts`)
  return item.roles
}

/** Screens that exist. Anything absent still renders a placeholder. */
const BUILT: Record<string, ComponentType> = {
  '/dashboard': DashboardPage,
  '/employees': EmployeesPage,
  '/managers': ManagersPage,
  '/profile': ProfilePage,
  '/attendance/me': MyAttendancePage,
  '/attendance': TeamAttendancePage,
  '/work-logs': WorkLogsPage,
  '/tasks': TasksPage,
  '/leaves': LeavesPage,
  '/leads': LeadsPage,
  '/notifications': NotificationsPage,
  '/live': LiveBoardPage,
  '/announcements': AnnouncementsPage,
  '/audit-logs': AuditLogsPage,
  '/settings': SettingsPage,
  '/analytics': AnalyticsPage,
  '/reports': ReportsPage,
}

/** Every nav destination is now built; kept for future additions. */
const PHASES: Record<string, string> = {}

export function AppRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        {/* --- Public ----------------------------------------------------- */}
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/signup"
          element={
            <PublicOnlyRoute>
              <SignupPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        {/* Not PublicOnly: arriving from the emailed link creates a session,
            which would immediately bounce the user away from the form. */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />

        {/* --- Authenticated ---------------------------------------------- */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />

          {NAV_ITEMS.map((item) => {
            const Screen = BUILT[item.to]
            return (
              <Route
                key={item.to}
                path={item.to}
                element={
                  <ProtectedRoute allowedRoles={rolesFor(item.to)}>
                    {Screen ? (
                      <Screen />
                    ) : (
                      <PlaceholderPage title={item.label} phase={PHASES[item.to] ?? 'a later phase'} />
                    )}
                  </ProtectedRoute>
                }
              />
            )
          })}

          {/* Detail routes are not nav entries, so they carry their guard
              explicitly rather than reading it from NAV_ITEMS. */}
          <Route
            path="/leads/:id"
            element={
              <ProtectedRoute allowedRoles={rolesFor('/leads')}>
                <LeadDetailPage />
              </ProtectedRoute>
            }
          />

          <Route path="/design-system" element={<DesignSystemPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
