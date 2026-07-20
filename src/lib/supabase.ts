import { createClient } from '@supabase/supabase-js'
import { env } from './env'
import type { Database } from './database.types'

/**
 * Single browser client for the whole app. Session persistence and refresh are
 * Supabase's job — the spec forbids a custom auth layer, so we configure it
 * here and never hand-roll token storage.
 */
export const supabase = createClient<Database>(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'tomatovation-erp-auth',
  },
  global: {
    headers: { 'x-application-name': 'tomatovation-erp' },
  },
})
