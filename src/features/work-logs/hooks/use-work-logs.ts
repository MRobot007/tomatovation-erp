import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createWorkLog,
  deleteWorkLog,
  listWorkLogs,
  reviewWorkLog,
  updateWorkLog,
  type WorkLogFilters,
  type WorkLogInsert,
  type WorkLogUpdate,
} from '../api/work-logs.api'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  all: ['work-logs'] as const,
  list: (filters: WorkLogFilters) => ['work-logs', 'list', filters] as const,
}

export function useWorkLogs(filters: WorkLogFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => listWorkLogs(filters),
    placeholderData: (previous) => previous,
  })
}

export function useCreateWorkLog() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: Omit<WorkLogInsert, 'employee_id'>) =>
      createWorkLog({ ...input, employee_id: user!.id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateWorkLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: WorkLogUpdate }) => updateWorkLog(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteWorkLog() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteWorkLog,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useReviewWorkLog() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      id,
      verdict,
      comment,
    }: {
      id: string
      verdict: 'reviewed' | 'needs_changes'
      comment: string | null
    }) => reviewWorkLog(id, user!.id, verdict, comment),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      // The review trigger raises a notification for the log's author.
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}
