import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface GlobalSearchResults {
  employees: Array<{ id: string; name: string; email: string }>
  leads: Array<{ id: string; company: string; contact_name: string | null }>
  tasks: Array<{ id: string; title: string }>
  workLogs: Array<{ id: string; project: string; task: string }>
}

const EMPTY: GlobalSearchResults = { employees: [], leads: [], tasks: [], workLogs: [] }

/** PostgREST parses these as filter syntax, so they cannot reach `or()` raw. */
function sanitise(term: string): string {
  return term.trim().replace(/[,()]/g, ' ')
}

/**
 * Four parallel queries rather than one RPC. Each table has its own RLS
 * policies, so running them separately means the search returns exactly what
 * the caller is allowed to see, per table, with no extra logic here.
 */
async function search(term: string): Promise<GlobalSearchResults> {
  const safe = sanitise(term)
  if (safe.length < 2) return EMPTY

  const pattern = `%${safe}%`
  const LIMIT = 5

  const [employees, leads, tasks, workLogs] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, name, email')
      .or(`name.ilike.${pattern},email.ilike.${pattern},department.ilike.${pattern}`)
      .limit(LIMIT),
    supabase
      .from('leads')
      .select('id, company, contact_name')
      .or(`company.ilike.${pattern},contact_name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(LIMIT),
    supabase
      .from('tasks')
      .select('id, title')
      .or(`title.ilike.${pattern},description.ilike.${pattern}`)
      .limit(LIMIT),
    supabase
      .from('work_logs')
      .select('id, project, task')
      .or(`project.ilike.${pattern},task.ilike.${pattern},description.ilike.${pattern}`)
      .limit(LIMIT),
  ])

  return {
    // A failure in one table degrades that section to empty rather than
    // failing the whole palette — searching leads should still work if the
    // tasks query errors.
    employees: employees.data ?? [],
    leads: leads.data ?? [],
    tasks: tasks.data ?? [],
    workLogs: (workLogs.data ?? []).map((log) => ({
      id: log.id,
      project: log.project,
      task: log.task,
    })),
  }
}

export function useGlobalSearch(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ['global-search', term],
    queryFn: () => search(term),
    // Two characters minimum: a single letter matches most of the database and
    // returns noise at the cost of four full scans.
    enabled: enabled && sanitise(term).length >= 2,
    staleTime: 30_000,
  })
}
