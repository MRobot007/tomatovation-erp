import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createAnnouncement,
  deleteAnnouncement,
  getSettings,
  listAnnouncements,
  listAuditLogs,
  updateAnnouncement,
  updateSettings,
  type AuditFilters,
  type SettingsUpdate,
} from '../api/admin.api'
import { useAuth } from '@/features/auth/auth-context'

const keys = {
  announcements: ['announcements'] as const,
  audit: (filters: AuditFilters) => ['audit-logs', filters] as const,
  settings: ['app-settings'] as const,
}

export function useAnnouncements() {
  return useQuery({ queryKey: keys.announcements, queryFn: listAnnouncements })
}

export function useCreateAnnouncement() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (input: { title: string; message: string; published: boolean }) =>
      createAnnouncement({ ...input, created_by: user!.id }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.announcements })
      // Publishing fans out a notification to every active employee.
      void queryClient.invalidateQueries({ queryKey: ['notifications'] })
    },
  })
}

export function useUpdateAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({
      id,
      patch,
    }: {
      id: string
      patch: { title?: string; message?: string; published?: boolean }
    }) => updateAnnouncement(id, patch),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.announcements }),
  })
}

export function useDeleteAnnouncement() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteAnnouncement,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: keys.announcements }),
  })
}

export function useAuditLogs(filters: AuditFilters) {
  return useQuery({
    queryKey: keys.audit(filters),
    queryFn: () => listAuditLogs(filters),
    placeholderData: (previous) => previous,
  })
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: getSettings })
}

export function useUpdateSettings() {
  const queryClient = useQueryClient()
  const { user } = useAuth()

  return useMutation({
    mutationFn: (patch: SettingsUpdate) => updateSettings(patch, user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: keys.settings })
      // Attendance metrics are derived from these values, so every cached
      // attendance result is now computed against stale settings.
      void queryClient.invalidateQueries({ queryKey: ['attendance'] })
    },
  })
}
