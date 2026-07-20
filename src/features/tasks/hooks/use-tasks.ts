import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  listTasks,
  setTaskStatus,
  updateTask,
  type TaskFilters,
  type TaskInsert,
  type TaskStatus,
  type TaskUpdate,
} from '../api/tasks.api'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  all: ['tasks'] as const,
  list: (filters: TaskFilters) => ['tasks', 'list', filters] as const,
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => listTasks(filters),
    placeholderData: (previous) => previous,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: Omit<TaskInsert, 'assigned_by'>) =>
      createTask({ ...input, assigned_by: user!.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.all })
      // Assignment fires a notification trigger for the assignee.
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: TaskUpdate }) => updateTask(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useSetTaskStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) => setTaskStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
