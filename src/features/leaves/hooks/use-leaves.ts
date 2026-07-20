import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  cancelLeave,
  countWorkingDays,
  decideLeave,
  deleteLeave,
  listLeaves,
  requestLeave,
  updateLeaveRequest,
  type LeaveFilters,
  type LeaveInsert,
} from '../api/leaves.api'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  all: ['leaves'] as const,
  list: (filters: LeaveFilters) => ['leaves', 'list', filters] as const,
  workingDays: (start: string, end: string) => ['leaves', 'working-days', start, end] as const,
}

export function useLeaves(filters: LeaveFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => listLeaves(filters),
    placeholderData: (previous) => previous,
  })
}

export function useWorkingDays(start: string, end: string) {
  return useQuery({
    queryKey: keys.workingDays(start, end),
    queryFn: () => countWorkingDays(start, end),
    enabled: Boolean(start && end && end >= start),
    staleTime: Infinity,
  })
}

export function useRequestLeave() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: Omit<LeaveInsert, 'employee_id'>) =>
      requestLeave({ ...input, employee_id: user!.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUpdateLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Omit<LeaveInsert, 'employee_id'> }) =>
      updateLeaveRequest(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDecideLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      status,
      note,
    }: {
      id: string
      status: 'approved' | 'rejected'
      note: string | null
    }) => decideLeave(id, status, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      // The decision trigger notifies the requester.
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useCancelLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: cancelLeave,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteLeave() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteLeave,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
