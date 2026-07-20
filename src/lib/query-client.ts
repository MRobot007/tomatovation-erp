import { QueryClient } from '@tanstack/react-query'

/**
 * Internal-tool defaults. Staff keep tabs open all day, so refetch-on-focus is
 * on: coming back to a stale attendance board is worse than a small request.
 * Retries stay low because a failing query here usually means an RLS denial or
 * a schema mismatch, and neither improves by asking again.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: (failureCount, error) => {
        const status = (error as { status?: number })?.status
        if (status && status >= 400 && status < 500) return false
        return failureCount < 2
      },
    },
    mutations: { retry: 0 },
  },
})
