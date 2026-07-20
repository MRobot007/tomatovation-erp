import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEmployee,
  listDepartments,
  listEmployees,
  listManagerCandidates,
  listManagersWithReports,
  setEmployeeStatus,
  updateEmployee,
  type EmployeeFilters,
  type EmployeeStatus,
  type EmployeeUpdate,
} from '../api/employees.api'

const keys = {
  all: ['employees'] as const,
  list: (filters: EmployeeFilters) => ['employees', 'list', filters] as const,
  detail: (id: string) => ['employees', 'detail', id] as const,
  managers: ['employees', 'managers'] as const,
  managerCandidates: ['employees', 'manager-candidates'] as const,
  departments: ['employees', 'departments'] as const,
}

export function useEmployees(filters: EmployeeFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => listEmployees(filters),
    // Keeps the previous page visible while a filter change refetches, so the
    // table does not collapse to a skeleton on every keystroke.
    placeholderData: (previous) => previous,
  })
}

export function useEmployee(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => getEmployee(id as string),
    enabled: Boolean(id),
  })
}

export function useManagerCandidates() {
  return useQuery({ queryKey: keys.managerCandidates, queryFn: listManagerCandidates })
}

export function useDepartments() {
  return useQuery({ queryKey: keys.departments, queryFn: listDepartments })
}

export function useManagersWithReports() {
  return useQuery({ queryKey: keys.managers, queryFn: listManagersWithReports })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EmployeeUpdate }) => updateEmployee(id, patch),
    onSuccess: (updated) => {
      // Invalidate the whole employees tree: a role or manager change alters
      // the manager list, the candidate picker and the department facets, not
      // just the one row.
      void queryClient.invalidateQueries({ queryKey: keys.all })
      // The edited person may be the signed-in user, whose own profile drives
      // the sidebar.
      void queryClient.invalidateQueries({ queryKey: ['profile', updated.id] })
    },
  })
}

export function useSetEmployeeStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: EmployeeStatus }) =>
      setEmployeeStatus(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}
