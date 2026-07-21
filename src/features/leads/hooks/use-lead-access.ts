import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

/**
 * Whether this user may see the sales pipeline.
 *
 * Asks the database rather than re-deriving the rule from role and department
 * in the browser. The rule already exists once, as `can_access_leads()`, and it
 * is what RLS enforces — a second copy here would be a second thing to keep in
 * step, and the copy that drifts is always the one in the UI.
 *
 * This only decides what to SHOW. Hiding the link is a courtesy so nobody
 * clicks through to an empty table; the policies are what make the data safe.
 */
export function useLeadAccess() {
  const query = useQuery({
    queryKey: ['lead-access'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_access_leads')
      if (error) throw error
      return data ?? false
    },
    // Department and role changes are rare and take effect on the next load.
    staleTime: 5 * 60_000,
  })

  return {
    // Undefined while loading is treated as no access, so the link cannot
    // flash into view and then disappear for someone who never had it.
    canAccessLeads: query.data ?? false,
    isLoading: query.isLoading,
  }
}
