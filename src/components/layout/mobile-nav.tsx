import * as Dialog from '@radix-ui/react-dialog'
import { NavLink } from 'react-router-dom'
import { X } from 'lucide-react'
import { groupedNavForRole } from '@/config/navigation'
import { ROLE_LABELS, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  role: Role
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MobileNav({ role, open, onOpenChange }: MobileNavProps) {
  const groups = groupedNavForRole(role)

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-ink/30 backdrop-blur-[2px] data-[state=open]:animate-fade-in lg:hidden" />
        <Dialog.Content
          className={cn(
            'fixed inset-y-0 left-0 z-50 flex w-sidebar flex-col border-r border-line bg-surface shadow-lg lg:hidden',
            'data-[state=open]:animate-rise-in',
          )}
        >
          <div className="flex h-topbar shrink-0 items-center gap-2.5 border-b border-line px-3">
            <div
              className="flex size-7 items-center justify-center rounded bg-tomato font-display text-md font-bold text-primary-foreground"
              aria-hidden
            >
              T
            </div>
            <div className="min-w-0 leading-tight">
              <Dialog.Title className="truncate font-display text-md font-semibold tracking-tight text-ink">
                Tomatovation
              </Dialog.Title>
              <Dialog.Description className="truncate text-2xs text-ink-subtle">
                {ROLE_LABELS[role]}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="ml-auto flex size-7 items-center justify-center rounded text-ink-muted transition-colors hover:bg-elevated hover:text-ink"
              aria-label="Close navigation"
            >
              <X className="size-4" aria-hidden />
            </Dialog.Close>
          </div>

          <nav className="flex-1 overflow-y-auto px-2 pb-4" aria-label="Main navigation">
            {groups.map((group) => (
              <div key={group.section} className="mb-4">
                <p className="eyebrow px-2 pb-1.5 pt-2">{group.section}</p>
                <ul className="flex flex-col gap-px">
                  {group.items.map((item) => (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        onClick={() => onOpenChange(false)}
                        className={({ isActive }) =>
                          cn(
                            'relative flex h-9 items-center gap-2.5 rounded px-2 text-base transition-colors',
                            isActive
                              ? 'bg-tomato-soft font-semibold text-tomato-ink'
                              : 'text-ink-muted hover:bg-elevated hover:text-ink',
                          )
                        }
                      >
                        <item.icon className="size-4 shrink-0" aria-hidden />
                        <span className="truncate">{item.label}</span>
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
