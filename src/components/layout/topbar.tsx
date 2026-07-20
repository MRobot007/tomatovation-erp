import { Menu, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UserMenu } from './user-menu'
import { NotificationBell } from '@/features/notifications/components/notification-bell'
import type { PresenceStatus } from '@/components/presence-dot'

interface TopbarProps {
  title: string
  presence: PresenceStatus
  onOpenMobileNav: () => void
  onOpenSearch: () => void
}

export function Topbar({ title, presence, onOpenMobileNav, onOpenSearch }: TopbarProps) {
  return (
    <header className="flex h-topbar shrink-0 items-center gap-3 border-b border-line bg-surface/85 px-3 backdrop-blur-sm md:px-4">
      <Button
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        onClick={onOpenMobileNav}
        aria-label="Open navigation"
      >
        <Menu aria-hidden />
      </Button>

      <h1 className="truncate font-display text-lg font-semibold tracking-tight text-ink">{title}</h1>

      <div className="ml-auto flex items-center gap-1.5">
        <SearchTrigger onClick={onOpenSearch} />
        <NotificationBell />
        <div className="ml-1 border-l border-line pl-2.5">
          <UserMenu presence={presence} />
        </div>
      </div>
    </header>
  )
}

/**
 * A fake input rather than a real one: it opens the command palette. Showing
 * the shortcut inline is what teaches people the palette exists at all.
 */
function SearchTrigger({ onClick }: { onClick: () => void }) {
  return (
    <>
      <button
        onClick={onClick}
        className="hidden h-7 items-center gap-2 rounded border border-line-strong bg-sunken/50 pl-2 pr-1.5 text-sm text-ink-subtle transition-colors hover:border-ink-subtle/60 hover:text-ink-muted md:flex md:w-56 lg:w-64"
      >
        <Search className="size-3.5 shrink-0" aria-hidden />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="rounded-sm border border-line bg-elevated px-1 font-mono text-2xs text-ink-subtle">
          ⌘K
        </kbd>
      </button>
      <Button variant="ghost" size="icon-sm" className="md:hidden" onClick={onClick} aria-label="Search">
        <Search aria-hidden />
      </Button>
    </>
  )
}
