import * as Dialog from '@radix-ui/react-dialog'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { groupedNavForRole } from '@/config/navigation'
import { useLeadAccess } from '@/features/leads/hooks/use-lead-access'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The same metal panel as the desktop rail, on a drawer.
 *
 * Deliberately not a lighter "mobile variant": the rail is a material, and a
 * material that changes when the window narrows stops being one. Same tokens,
 * same bevels, same sweep.
 */
export function MobileNav({ role, open, onOpenChange }: MobileNavProps) {
  const { canAccessLeads } = useLeadAccess()
  const groups = groupedNavForRole(role, { crm: canAccessLeads })

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/40 backdrop-blur-[2px] data-[state=open]:animate-fade-in lg:hidden" />
        <Dialog.Content
          className={cn(
            'rail rail-grain fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col shadow-lg lg:hidden',
            'data-[state=open]:animate-rise-in',
          )}
        >
          <div className="relative flex h-topbar shrink-0 items-center gap-2.5 px-3 shadow-[inset_0_-1px_0_hsl(0_0%_0%/0.4),inset_0_-2px_0_hsl(var(--rail-sheen)/0.04)]">
            <span
              className="flex size-8 shrink-0 items-center justify-center font-display text-2xl font-bold leading-none text-white drop-shadow-[0_1px_2px_hsl(0_0%_0%/0.6)]"
              aria-hidden
            >
              T
            </span>
            <div className="min-w-0 leading-tight">
              <Dialog.Title className="truncate font-display text-md font-semibold tracking-tight text-[hsl(var(--rail-ink))]">
                Tomatovation
              </Dialog.Title>
              <Dialog.Description className="truncate text-2xs uppercase tracking-[0.14em] text-[hsl(var(--rail-ink-subtle))]">
                {ROLE_LABELS[role]}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="rail-item ml-auto flex size-8 items-center justify-center rounded text-[hsl(var(--rail-ink-muted))] hover:text-[hsl(var(--rail-ink))]"
              aria-label="Close navigation"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>

          <nav className="relative flex-1 overflow-y-auto px-2 pb-4" aria-label="Main navigation">
            {groups.map((group) => (
              <div key={group.section} className="mb-4">
                <p className="px-2 pb-1.5 pt-3 text-eyebrow font-semibold uppercase text-[hsl(var(--rail-ink-subtle))]">
                  {group.section}
                </p>
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        className={({ isActive }) =>
                          cn(
                            'rail-item group flex h-10 items-center gap-2.5 rounded px-2 text-base',
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
                                isActive
                                  ? 'text-brand drop-shadow-[0_0_6px_hsl(var(--brand)/0.55)]'
                                  : 'drop-shadow-[0_1px_0_hsl(0_0%_0%/0.5)]',
                              )}
                              aria-hidden
                            />
                            <span className="truncate">{item.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
