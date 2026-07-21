import { Moon, Sun } from 'lucide-react'
import { useTheme } from './theme-provider'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', icon: Sun, label: 'Light' },
  { value: 'dark', icon: Moon, label: 'Dark' },
] as const

/**
 * A plain Light / Dark switch. "System" was dropped on request — most people
 * pick one and stay, so a third option was a decision nobody wanted to make.
 * The provider still honours a stored 'system' value if one lingers; this
 * control just no longer offers it.
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="radiogroup"
      aria-label="Colour theme"
      className="inline-flex items-center gap-0.5 rounded border border-line bg-elevated p-0.5"
    >
      {OPTIONS.map(({ value, icon: Icon, label }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => setTheme(value)}
          className={cn(
            'flex size-6 items-center justify-center rounded-sm transition-colors duration-150',
            theme === value
              ? 'bg-surface text-ink shadow-sm'
              : 'text-ink-subtle hover:text-ink-muted',
          )}
        >
          <Icon className="size-3.5" aria-hidden />
        </button>
      ))}
    </div>
  )
}
