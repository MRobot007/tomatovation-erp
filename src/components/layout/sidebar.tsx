import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { groupedNavForRole } from '@/config/navigation'
import { useLeadAccess } from '@/features/leads/hooks/use-lead-access'
import type { Role } from '@/lib/roles'
import { Brand } from './brand'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: Role
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * A flat, solid dark sidebar panel against the light content area.
 *
 * The active item is marked with a tomato edge bar and a faint wash rather than
 * a filled pill — it keeps the vertical rhythm of the list unbroken, which
 * matters at 15+ entries. The dark panel is also the one surface a white logo
 * can sit on at full strength.
 */
export function Sidebar({ role, collapsed, onToggleCollapsed }: SidebarProps) {
  const { canAccessLeads } = useLeadAccess()
  const groups = groupedNavForRole(role, { crm: canAccessLeads })

  return (
    <aside
      className={cn(
        'rail relative hidden h-full shrink-0 flex-col transition-[width] duration-300 ease-out-expo lg:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <Brand collapsed={collapsed} role={role} />

      <nav
        className="relative flex-1 overflow-y-auto px-2 pb-4 [scrollbar-width:thin]"
        aria-label="Main navigation"
      >
        {groups.map((group) => (
          <div key={group.section} className="mb-4">
            {!collapsed && (
              <p className="px-2 pb-1.5 pt-3 text-eyebrow font-semibold uppercase text-[hsl(var(--rail-ink-subtle))]">
                {group.section}
              </p>
            )}
            {/* Collapsed: the group heading has nowhere to go, so the grouping
                is carried by a plain hairline divider instead. */}
            {collapsed && (
              <div className="mx-3 my-2.5 h-px bg-[hsl(var(--rail-line))]" aria-hidden />
            )}

            <ul className="flex flex-col gap-0.5">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'rail-item group flex h-9 items-center gap-2.5 rounded px-2 text-sm',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'rail-item-active font-semibold text-[hsl(var(--rail-ink))]'
                          : 'text-[hsl(var(--rail-ink-muted))] hover:text-[hsl(var(--rail-ink))]',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && <span className="rail-marker" aria-hidden />}
                        <item.icon
                          className={cn(
                            'size-4 shrink-0',
                            isActive && 'text-[hsl(var(--rail-accent))]',
                          )}
                          aria-hidden
                        />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="relative border-t border-[hsl(var(--rail-line))] p-2">
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'rail-item flex h-8 w-full items-center justify-center gap-1.5 rounded',
            'text-xs text-[hsl(var(--rail-ink-subtle))] hover:text-[hsl(var(--rail-ink))]',
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" aria-hidden />
          ) : (
            <PanelLeftClose className="size-4" aria-hidden />
          )}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  )
}
