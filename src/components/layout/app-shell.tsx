import { useCallback, useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { MobileNav } from './mobile-nav'
import { CommandPalette } from '@/features/search/command-palette'
import { NAV_ITEMS } from '@/config/navigation'
import { useAuth } from '@/features/auth/auth-context'
import { useNotificationsRealtime } from '@/features/notifications/hooks/use-notifications'
import { useMyAttendanceToday } from '@/features/attendance/hooks/use-attendance'
import type { PresenceStatus } from '@/components/presence-dot'

const COLLAPSE_KEY = 'tomatovation-erp-sidebar-collapsed'

/** Longest matching nav prefix wins, so /leads/123 still titles as "Leads". */
function titleForPath(pathname: string): string {
  const match = [...NAV_ITEMS]
    .filter((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return match?.label ?? 'Tomatovation'
}

export function AppShell() {
  const { pathname } = useLocation()
  const { role } = useAuth()
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(
    () => window.localStorage.getItem(COLLAPSE_KEY) === 'true',
  )

  const toggleCollapsed = useCallback(() => {
    setCollapsed((previous) => {
      const next = !previous
      window.localStorage.setItem(COLLAPSE_KEY, String(next))
      return next
    })
  }, [])

  const openSearch = useCallback(() => {
    // Phase 13 mounts the command palette; it listens for this event so the
    // trigger does not need to know whether the palette is loaded yet.
    window.dispatchEvent(new CustomEvent('erp:open-command-palette'))
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        openSearch()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSearch])

  // Mounted once for the whole authenticated app: one socket, not one per
  // screen that happens to care about notifications.
  useNotificationsRealtime()

  // Presence is derived from today's attendance row rather than tracked
  // separately — "working" means actually clocked in, not merely tab-open.
  const { data: today } = useMyAttendanceToday()
  const presence: PresenceStatus = today?.break_started_at
    ? 'break'
    : today?.punch_in && !today.punch_out
      ? 'working'
      : 'online'

  // ProtectedRoute guarantees a profile before this mounts, so role is set.
  if (!role) return null

  return (
    <div className="flex h-dvh overflow-hidden bg-paper">
      <Sidebar role={role} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <MobileNav role={role} open={mobileNavOpen} onOpenChange={setMobileNavOpen} />
      <CommandPalette />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          title={titleForPath(pathname)}
          presence={presence}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onOpenSearch={openSearch}
        />

        <main className="grain flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 md:px-6 md:py-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  )
}
