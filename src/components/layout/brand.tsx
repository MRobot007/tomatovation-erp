import { ROLE_LABELS, type Role } from '@/lib/roles'
import { cn } from '@/lib/utils'

/**
 * Drop a WHITE logo at src/assets/logo.svg (or .png / .webp) and it replaces
 * the lettermark on the next build. Nothing else to change.
 *
 * A white mark is unusable on the paper-coloured content area, which is why
 * the brand lockup lives on the dark rail — it is the one surface in the app
 * that a white logo can sit on at full strength.
 *
 * Resolved at BUILD time rather than by pointing an <img> at /logo.svg and
 * catching onError. Both work, but the runtime version 404s on every page load
 * until the file exists, and a console full of expected errors is where real
 * ones go to hide.
 */
const LOGO_FILES = import.meta.glob<{ default: string }>('../../assets/logo.{svg,png,webp}', {
  eager: true,
})
const LOGO_SRC: string | undefined = Object.values(LOGO_FILES)[0]?.default

/**
 * The brand block at the head of the rail.
 *
 * Falls back to a machined lettermark until a real logo file exists, rather
 * than rendering a broken image or an empty gap. Both treatments are built to
 * the same size and optical weight, so dropping the file in does not shift the
 * layout underneath it.
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
      <div className="relative flex size-8 shrink-0 items-center justify-center">
        {LOGO_SRC ? (
          <img src={LOGO_SRC} alt="Tomatovation" className="size-8 object-contain" />
        ) : (
          <Lettermark />
        )}
      </div>

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
 * Stand-in mark: a milled tile with a tomato face.
 *
 * The bevel is two inset shadows — lit on the top edge, shadowed on the
 * bottom — which is the same trick the rail uses, so the placeholder belongs
 * to the surface it sits on instead of floating above it.
 */
function Lettermark() {
  return (
    <div
      className={cn(
        'flex size-8 items-center justify-center rounded-[0.3125rem]',
        'bg-gradient-to-b from-tomato to-tomato-hover',
        'font-display text-lg font-bold leading-none text-white',
        'shadow-[inset_0_1px_0_hsl(var(--rail-sheen)/0.4),inset_0_-1px_0_hsl(0_0%_0%/0.25),0_1px_3px_hsl(0_0%_0%/0.4)]',
      )}
      aria-hidden
    >
      T
    </div>
  )
}
