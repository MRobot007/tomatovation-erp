import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  addLeadActivity,
  createLead,
  deleteLead,
  getLead,
  listFollowupsDue,
  listLeadActivities,
  listLeads,
  updateLead,
  type LeadFilters,
  type LeadInsert,
  type LeadUpdate,
} from '../api/leads.api'
import { useAuth } from '@/features/auth/auth-context'
import type { Database } from '@/lib/database.types'

const keys = {
  all: ['leads'] as const,
  list: (filters: LeadFilters) => ['leads', 'list', filters] as const,
  detail: (id: string) => ['leads', 'detail', id] as const,
  activities: (id: string) => ['leads', 'activities', id] as const,
  followups: (date: string, assignedTo?: string) => ['leads', 'followups', date, assignedTo] as const,
}

export function useLeads(filters: LeadFilters) {
  return useQuery({
    queryKey: keys.list(filters),
    queryFn: () => listLeads(filters),
    placeholderData: (previous) => previous,
  })
}

export function useLead(id: string | undefined) {
  return useQuery({
    queryKey: keys.detail(id ?? ''),
    queryFn: () => getLead(id as string),
    enabled: Boolean(id),
  })
}

export function useLeadActivities(id: string | undefined) {
  return useQuery({
    queryKey: keys.activities(id ?? ''),
    queryFn: () => listLeadActivities(id as string),
    enabled: Boolean(id),
  })
}

export function useFollowupsDue(date: string | undefined, assignedTo?: string) {
  return useQuery({
    queryKey: keys.followups(date ?? '', assignedTo),
    queryFn: () => listFollowupsDue(date as string, assignedTo),
    enabled: Boolean(date),
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: Omit<LeadInsert, 'created_by'>) =>
      createLead({ ...input, created_by: user!.id }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: LeadUpdate }) => updateLead(id, patch),
    onSuccess: (_data, variables) => {
      // The status-change trigger appends to the timeline, so activities are
      // invalidated too even though this call never touched them.
      void queryClient.invalidateQueries({ queryKey: keys.all })
      void queryClient.invalidateQueries({ queryKey: keys.activities(variables.id) })
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteLead,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.all }),
  })
}

export function useAddActivity() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: ({
      leadId,
      activity,
      remarks,
    }: {
      leadId: string
      activity: Database['public']['Enums']['lead_activity_kind']
      remarks: string | null
    }) => addLeadActivity({ lead_id: leadId, employee_id: user!.id, activity, remarks }),
    onSuccess: (_data, variables) =>
      void queryClient.invalidateQueries({ queryKey: keys.activities(variables.leadId) }),
  })
}
