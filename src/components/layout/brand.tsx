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
 * Stand-in mark: a white letter, because that is what is coming.
 *
 * Deliberately a plain white glyph rather than a tile or a badge. The real
 * logo is a pure-white letterform, so the placeholder should occupy the same
 * optical space and weight — anything with a filled background would look
 * right here and then leave a hole the moment the real file replaced it.
 */
function Lettermark() {
  return (
    <span
      className="font-display text-2xl font-bold leading-none text-white drop-shadow-[0_1px_2px_hsl(0_0%_0%/0.6)]"
      aria-hidden
    >
      T
    </span>
  )
}
