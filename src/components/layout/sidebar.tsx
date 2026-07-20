import { NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { groupedNavForRole } from '@/config/navigation'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  role: Role
  collapsed: boolean
  onToggleCollapsed: () => void
}

/**
 * The active item is marked with a left rule and a tinted field rather than a
 * filled pill — it keeps the vertical rhythm of the list unbroken, which
 * matters when there are 15+ entries.
 */
export function Sidebar({ role, collapsed, onToggleCollapsed }: SidebarProps) {
  const groups = groupedNavForRole(role)

  return (
    <aside
      className={cn(
        'hidden h-full shrink-0 flex-col border-r border-line bg-surface transition-[width] duration-200 ease-out-expo lg:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar',
      )}
    >
      <Brand collapsed={collapsed} role={role} />

      <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main navigation">
        {groups.map((group) => (
          <div key={group.section} className="mb-4">
            {!collapsed && <p className="eyebrow px-2 pb-1.5 pt-2">{group.section}</p>}
            {collapsed && <div className="mx-2 my-2 h-px bg-line" aria-hidden />}

            <ul className="flex flex-col gap-px">
              {group.items.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    title={collapsed ? item.label : undefined}
                    className={({ isActive }) =>
                      cn(
                        'group relative flex h-8 items-center gap-2.5 rounded px-2 text-sm transition-colors duration-150',
                        collapsed && 'justify-center px-0',
                        isActive
                          ? 'bg-tomato-soft font-semibold text-tomato-ink'
                          : 'text-ink-muted hover:bg-elevated hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {isActive && (
                          <span
                            className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-tomato"
                            aria-hidden
                          />
                        )}
                        <item.icon className="size-4 shrink-0" aria-hidden />
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

      <div className="border-t border-line p-2">
        <Button
          variant="ghost"
          size={collapsed ? 'icon-sm' : 'sm'}
          onClick={onToggleCollapsed}
          className={cn('w-full', collapsed && 'w-7')}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <PanelLeftOpen aria-hidden /> : <PanelLeftClose aria-hidden />}
          {!collapsed && <span className="ml-1">Collapse</span>}
        </Button>
      </div>
    </aside>
  )
}

function Brand({ collapsed, role }: { collapsed: boolean; role: Role }) {
  return (
    <div
      className={cn(
        'flex h-topbar shrink-0 items-center gap-2.5 border-b border-line px-3',
        collapsed && 'justify-center px-0',
      )}
    >
      <div
        className="flex size-7 shrink-0 items-center justify-center rounded bg-tomato font-display text-md font-bold text-primary-foreground shadow-sm"
        aria-hidden
      >
        T
      </div>
      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-md font-semibold tracking-tight text-ink">
            Tomatovation
          </p>
          <p className="truncate text-2xs text-ink-subtle">{ROLE_LABELS[role]}</p>
        </div>
      )}
    </div>
  )
}
