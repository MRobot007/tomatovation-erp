import { useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'

/**
 * URL is the source of truth for filters, sorting and pagination — the spec
 * requires it, and it is what makes a filtered view shareable and
 * back-button-correct. Nothing here duplicates state into React.
 */
/**
 * `NoInfer` on the default keeps it from driving inference. Without it,
 * useSearchParamState('status', 'all') infers T as the literal 'all', and the
 * setter then rejects every other status.
 */
export function useSearchParamState<T extends string = string>(
  key: string,
  defaultValue: NoInfer<T>,
): [T, (value: T) => void] {
  const [params, setParams] = useSearchParams()
  const value = (params.get(key) as T | null) ?? defaultValue

  const setValue = useCallback(
    (next: T) => {
      setParams(
        (current) => {
          const updated = new URLSearchParams(current)
          // Never write the default into the URL — it produces noisy links like
          // ?status=all&sort=name that say nothing.
          if (next === defaultValue || next === '') updated.delete(key)
          else updated.set(key, next)
          // Changing a filter must reset paging, or you land on page 4 of a
          // 2-page result and see an empty table.
          if (key !== 'page') updated.delete('page')
          return updated
        },
        { replace: true },
      )
    },
    [key, defaultValue, setParams],
  )

  return [value, setValue]
}

export interface SortState {
  column: string
  direction: 'asc' | 'desc'
}

/** Sort encoded as a single param: `?sort=name` / `?sort=-name`. */
export function useSortParam(defaultColumn: string, defaultDirection: 'asc' | 'desc' = 'asc') {
  const [raw, setRaw] = useSearchParamState(
    'sort',
    defaultDirection === 'desc' ? `-${defaultColumn}` : defaultColumn,
  )

  const sort = useMemo<SortState>(() => {
    const descending = raw.startsWith('-')
    return { column: descending ? raw.slice(1) : raw, direction: descending ? 'desc' : 'asc' }
  }, [raw])

  const toggleSort = useCallback(
    (column: string) => {
      // First click on a new column sorts ascending; clicking the active
      // column flips it. No third "unsorted" state — an unordered table is
      // never what someone wanted.
      if (sort.column === column) {
        setRaw(sort.direction === 'asc' ? `-${column}` : column)
      } else {
        setRaw(column)
      }
    },
    [sort, setRaw],
  )

  return { sort, toggleSort }
}
