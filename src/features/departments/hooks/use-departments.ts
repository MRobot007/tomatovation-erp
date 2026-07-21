import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createDepartment, listDepartments } from '../api/departments.api'

export const departmentKeys = {
  all: ['departments'] as const,
}

export function useDepartments() {
  return useQuery({ queryKey: departmentKeys.all, queryFn: listDepartments })
}

export function useCreateDepartment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createDepartment,
    onSuccess: () => {
      // The roster filter reads the same list, so it has to refetch too or a
      // department added from the employee form is missing from the filter
      // until a reload.
      void queryClient.invalidateQueries({ queryKey: departmentKeys.all })
    },
  })
}
