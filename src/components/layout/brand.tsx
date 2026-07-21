import { ROLE_LABELS, type Role } from '@/lib/roles'
import { logoLockup, LOGO_MARK_ASPECT } from '@/lib/logo'
import { cn } from '@/lib/utils'

/**
 * The brand block at the head of the rail.
 *
 * The rail is dark, so the white logo sits on it at full strength — this is
 * one of the two surfaces in the app where it can. The sidebar shows the MARK
 * only: the lockup's wordmark and tagline are illegible at header size, and
 * "Tomatovation" is spelled out beside it in type anyway.
 */
export function Brand({ collapsed, role }: { collapsed: boolean; role: Role }) {
  return (
    <div
      className={cn(
        'relative flex h-topbar shrink-0 items-center gap-2.5 px-3',
        // Not a border: a hairline of shadow under a lit edge is how a real
        // panel joint reads, and it keeps the metal continuous.
        'shadow-[inset_0_-1px_0_hsl(0_0%_0%/0.4),inset_0_-2px_0_hsl(var(--rail-sheen)/0.04)]',
        collapsed && 'justify-center px-0',
      )}
    >
      <LogoMark className={collapsed ? 'h-6' : 'h-8'} />

      {!collapsed && (
        <div className="min-w-0 leading-tight">
          <p className="truncate font-display text-md font-semibold tracking-tight text-[hsl(var(--rail-ink))]">
            Tomatovation
          </p>
          <p className="truncate text-2xs uppercase tracking-[0.14em] text-[hsl(var(--rail-ink-subtle))]">
            {ROLE_LABELS[role]}
          </p>
        </div>
      )}
    </div>
  )
}

/**
 * The mark, cropped out of the full lockup.
 *
 * There is one asset and it stacks mark / wordmark / tagline, so the mark is
 * shown by giving the container the mark's aspect ratio and clipping the rest:
 * the image is full-width and top-aligned, so its taller-than-the-box height
 * pushes the wordmark past the bottom edge, where overflow-hidden removes it.
 * No pixel offsets to drift — the crop is "show the top 64%".
 */
function LogoMark({ className }: { className?: string }) {
  return (
    <div
      className={cn('shrink-0 overflow-hidden', className)}
      style={{ aspectRatio: LOGO_MARK_ASPECT }}
    >
      <img
        src={logoLockup}
        alt="Tomatovation"
        className="block w-full select-none"
        draggable={false}
      />
    </div>
  )
}
