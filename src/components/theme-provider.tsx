import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

type Theme = 'light' | 'dark' | 'system'

interface ThemeContextValue {
  theme: Theme
  resolved: 'light' | 'dark'
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)
/**
 * The `-v2` matters.
 *
 * Switching the default to dark did nothing for anyone who had already opened
 * the app: a stored value always wins over a default, so every existing user
 * stayed exactly where they were and saw none of the redesign. Retiring the old
 * key is what actually lands it. Anyone who preferred light simply picks it
 * again — one click, against a design that otherwise never gets seen.
 */
const STORAGE_KEY = 'tomatovation-erp-theme-v2'

/**
 * Light is the default, not 'system'.
 *
 * The composition is black glass on a white page — the panes are the dark
 * thing, and the page is what makes them read as panes. Following the OS would
 * hand half of everyone the inverted version of a design whose whole point is
 * that contrast. Dark mode still works and is a click away.
 *
 * An explicit choice always wins: this only sets where someone starts.
 */
function readStoredTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'light'
}

function systemPrefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)
  const [systemDark, setSystemDark] = useState(
    () => typeof window !== 'undefined' && systemPrefersDark(),
  )

  // Track OS changes so 'system' stays live rather than snapshotting at boot.
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  const resolved: 'light' | 'dark' = theme === 'system' ? (systemDark ? 'dark' : 'light') : theme

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', resolved === 'dark')
    root.style.colorScheme = resolved
  }, [resolved])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolved,
      setTheme: (next: Theme) => {
        window.localStorage.setItem(STORAGE_KEY, next)
        setThemeState(next)
      },
    }),
    [theme, resolved],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside <ThemeProvider>')
  return context
}
