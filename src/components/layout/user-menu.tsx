import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LogOut, Settings, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { UserAvatar } from '@/components/ui/avatar'
import { PresenceDot, type PresenceStatus } from '@/components/presence-dot'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/features/auth/auth-context'
import { signOut } from '@/features/auth/api/auth.api'
import { ROLE_LABELS } from '@/lib/roles'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'

export function UserMenu({ presence }: { presence: PresenceStatus }) {
  const { profile, role } = useAuth()
  const [confirmingSignOut, setConfirmingSignOut] = useState(false)

  if (!profile) return null

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded px-1 py-0.5 transition-colors hover:bg-elevated">
          <div className="relative">
            <UserAvatar name={profile.name} src={profile.profile_photo} size="sm" />
            <PresenceDot
              status={presence}
              className="absolute -bottom-0.5 -right-0.5 ring-2 ring-surface"
            />
          </div>
          <span className="hidden max-w-28 truncate text-sm font-medium text-ink lg:block">
            {profile.name}
          </span>
          <ChevronDown className="hidden size-3 text-ink-subtle lg:block" aria-hidden />
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="min-w-56">
          <DropdownMenuLabel>
            <p className="truncate text-sm font-medium text-ink">{profile.name}</p>
            <p className="truncate text-xs text-ink-subtle">{profile.email}</p>
            {role && (
              <p className="mt-1 text-2xs font-semibold uppercase tracking-wider text-brand">
                {ROLE_LABELS[role]}
              </p>
            )}
          </DropdownMenuLabel>

          <DropdownMenuSeparator />

          <DropdownMenuItem asChild>
            <Link to="/profile">
              <UserRound aria-hidden />
              My profile
            </Link>
          </DropdownMenuItem>

          {role === 'super_admin' && (
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings aria-hidden />
                Settings
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-sm text-ink-muted">Theme</span>
            <ThemeToggle />
          </div>

          <DropdownMenuSeparator />

          <DropdownMenuItem
            destructive
            onSelect={(event) => {
              // Let the menu close before the dialog mounts, or Radix fights
              // itself over focus and the dialog opens without it.
              event.preventDefault()
              setConfirmingSignOut(true)
            }}
          >
            <LogOut aria-hidden />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmDialog
        open={confirmingSignOut}
        onOpenChange={setConfirmingSignOut}
        title="Sign out?"
        description="You will need to enter your email and password again to get back in."
        confirmLabel="Sign out"
        onConfirm={() => signOut()}
      />
    </>
  )
}
