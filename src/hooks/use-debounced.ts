import { useEffect, useState } from 'react'

/**
 * Delays a rapidly-changing value. Used so a search box updates the URL on
 * every keystroke (the address bar should track what was typed) while the
 * database query fires only once the typing pauses.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
