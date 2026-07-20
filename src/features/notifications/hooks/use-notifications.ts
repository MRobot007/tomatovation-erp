import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  countUnread,
  deleteNotification,
  listNotifications,
  markAllAsRead,
  markAsRead,
} from '../api/notifications.api'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  all: ['notifications'] as const,
  list: ['notifications', 'list'] as const,
  unread: ['notifications', 'unread'] as const,
}

export function useNotifications(limit = 50) {
  return useQuery({
    queryKey: [...keys.list, limit],
    queryFn: () => listNotifications(limit),
  })
}

export function useUnreadCount() {
  return useQuery({
    queryKey: keys.unread,
    queryFn: countUnread,
    // Realtime pushes the updates; this interval is only a safety net for a
    // dropped socket, so it is deliberately slow.
    refetchInterval: 5 * 60_000,
  })
}

/**
 * Subscribes to this user's notification stream.
 *
 * The filter is applied server-side by Realtime as well as by RLS. Without it
 * every client would receive every insert and discard most of them — RLS would
 * still prevent reading the contents, but the socket traffic is pointless.
 */
export function useNotificationsRealtime() {
  const { user } = useAuth()
  const queryClient = useQueryClient()

  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          // Invalidate rather than patch the cache from the payload: the row
          // shape here must match what the list query selects, and keeping two
          // sources of truth in step is how stale badges happen.
          void queryClient.invalidateQueries({ queryKey: keys.all })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [user?.id, queryClient])
}

export function useMarkAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAsRead,
    // Optimistic: the badge must drop the instant the bell item is clicked,
    // not after a round trip.
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: keys.all })
      const previousCount = queryClient.getQueryData<number>(keys.unread)

      queryClient.setQueryData<number>(keys.unread, (count) => Math.max(0, (count ?? 1) - 1))

      return { previousCount, id }
    },
    onError: (_error, _id, context) => {
      if (context?.previousCount != null) {
        queryClient.setQueryData(keys.unread, context.previousCount)
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useMarkAllAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAllAsRead,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: keys.all })
      const previousCount = queryClient.getQueryData<number>(keys.unread)
      queryClient.setQueryData<number>(keys.unread, 0)
      return { previousCount }
    },
    onError: (_error, _variables, context) => {
      if (context?.previousCount != null) {
        queryClient.setQueryData(keys.unread, context.previousCount)
      }
    },
    onSettled: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteNotification() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteNotification,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
