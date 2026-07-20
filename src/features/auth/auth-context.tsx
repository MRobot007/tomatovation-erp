import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { fetchProfile, type Profile } from './api/auth.api'
import { isRole, type Role } from '@/lib/roles'

interface AuthContextValue {
  user: User | null
  session: Session | null
  profile: Profile | null
  role: Role | null
  /** True until the initial session check AND first profile fetch settle. */
  loading: boolean
  profileError: unknown
  refetchProfile: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const queryClient = useQueryClient()

  useEffect(() => {
    let active = true

    // Existing session first, so a returning user lands on the dashboard
    // without re-entering credentials.
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
      })
      .finally(() => {
        if (active) setSessionChecked(true)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return

      // Deliberately synchronous. Calling any other supabase.* method inside
      // this callback can deadlock: the client holds an internal lock while
      // the callback runs, and the awaited call queues behind it. The profile
      // fetch is left to the query below, which runs in its own context.
      setSession(nextSession)
      setSessionChecked(true)

      if (event === 'SIGNED_OUT') {
        // Drop every cached query. Without this, the next person to sign in on
        // this machine briefly sees the previous user's rows.
        queryClient.clear()
      }
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [queryClient])

  const userId = session?.user.id ?? null

  const {
    data: profile,
    isLoading: profileLoading,
    error: profileError,
    refetch,
  } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId as string),
    enabled: userId != null,
    // Short, because this row decides what the user is allowed to see. A long
    // stale window means a promotion, a demotion, or a deactivation keeps
    // applying the old permissions until the cache happens to expire. The row
    // is one record — refetching it on focus costs nothing worth saving.
    staleTime: 30_000,
    // A null profile means the handle_new_user trigger has not committed yet —
    // a real race immediately after signup. Retry briefly rather than showing
    // a broken account.
    retry: (failureCount, error) => {
      if (error) return failureCount < 2
      return false
    },
  })

  // The row can legitimately be absent for a beat after signup. Poll until it
  // appears rather than leaving the user in a permanently empty shell.
  useEffect(() => {
    if (userId == null || profile != null || profileLoading) return
    const timer = window.setTimeout(() => void refetch(), 800)
    return () => window.clearTimeout(timer)
  }, [userId, profile, profileLoading, refetch])

  const value = useMemo<AuthContextValue>(() => {
    const rawRole = profile?.role
    return {
      user: session?.user ?? null,
      session,
      profile: profile ?? null,
      role: isRole(rawRole) ? rawRole : null,
      loading: !sessionChecked || (userId != null && profileLoading),
      profileError,
      refetchProfile: () => void refetch(),
    }
  }, [session, profile, sessionChecked, userId, profileLoading, profileError, refetch])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>')
  return context
}
