import { useState } from 'react'
import { MessageSquare, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { WorkLogDialog } from '@/features/work-logs/components/work-log-dialog'
import { ReviewDialog } from '@/features/work-logs/components/review-dialog'
import { AttachmentBadge } from '@/features/storage/components/file-upload'
import { useDeleteWorkLog, useWorkLogs } from '@/features/work-logs/hooks/use-work-logs'
import type { WorkLogRow } from '@/features/work-logs/api/work-logs.api'
import { useSearchParamState, useSortParam } from '@/hooks/use-search-param-state'
import { useDebounced } from '@/hooks/use-debounced'
import { useAuth } from '@/features/auth/auth-context'
import { atLeast } from '@/lib/roles'
import { formatHours } from '@/lib/utils'

const STATUS_TONE = {
  draft: 'neutral',
  submitted: 'info',
  reviewed: 'success',
  needs_changes: 'warning',
} as const

const STATUS_LABEL = {
  draft: 'Draft',
  submitted: 'Submitted',
  reviewed: 'Reviewed',
  needs_changes: 'Needs changes',
} as const

export function WorkLogsPage() {
  const { user, role } = useAuth()
  const canReview = atLeast(role, 'manager')

  const [scope, setScope] = useSearchParamState('scope', 'mine')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const [search, setSearch] = useSearchParamState('q', '')
  const { sort, toggleSort } = useSortParam('log_date', 'desc')
  const debouncedSearch = useDebounced(search, 300)

  const { data, isLoading, error, refetch } = useWorkLogs({
    // 'mine' filters to the signed-in user; 'team' drops the filter and lets
    // RLS decide the scope.
    employeeId: scope === 'mine' ? user?.id : undefined,
    status: status as never,
    search: debouncedSearch,
    sortColumn: sort.column,
    sortDirection: sort.direction,
  })

  const [editing, setEditing] = useState<WorkLogRow | null>(null)
  const [creating, setCreating] = useState(false)
  const [reviewing, setReviewing] = useState<WorkLogRow | null>(null)
  const [deleting, setDeleting] = useState<WorkLogRow | null>(null)
  const deleteLog = useDeleteWorkLog()

  const totalHours = (data ?? []).reduce((sum, row) => sum + Number(row.hours), 0)

  const columns: ReadonlyArray<Column<WorkLogRow>> = [
    {
      id: 'log_date',
      header: 'Date',
      sortable: true,
      cell: (row) => (
        <span className="font-mono text-sm" data-numeric>
          {new Date(`${row.log_date}T00:00:00`).toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
          })}
        </span>
      ),
    },
    ...(scope === 'team'
      ? [
          {
            id: 'employee',
            header: 'Employee',
            cell: (row: WorkLogRow) => (
              <div className="flex items-center gap-2">
                <UserAvatar name={row.employee?.name} src={row.employee?.profile_photo} size="xs" />
                <span className="truncate">{row.employee?.name ?? 'Unknown'}</span>
              </div>
            ),
          } satisfies Column<WorkLogRow>,
        ]
      : []),
    {
      id: 'project',
      header: 'Project',
      sortable: true,
      cell: (row) => <span className="font-medium text-ink">{row.project}</span>,
    },
    {
      id: 'task',
      header: 'Task',
      cell: (row) => <span className="line-clamp-1 text-ink-muted">{row.task}</span>,
    },
    { id: 'hours', header: 'Hours', sortable: true, numeric: true, cell: (row) => formatHours(row.hours) },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
          {row.review_comment && (
            <MessageSquare className="size-3 text-ink-subtle" aria-label="Has a review comment" />
          )}
          <AttachmentBadge path={row.attachment} />
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Daily"
        title="Work logs"
        description="What you worked on, how long it took, and what is next."
        actions={
          <>
            <Badge tone="neutral">{formatHours(totalHours)} total</Badge>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Log work
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canReview && (
          <div className="inline-flex rounded border border-line bg-elevated p-0.5" role="tablist">
            {(['mine', 'team'] as const).map((value) => (
              <button
                key={value}
                role="tab"
                aria-selected={scope === value}
                onClick={() => setScope(value)}
                className={
                  scope === value
                    ? 'rounded-sm bg-surface px-3 py-1 text-sm font-medium text-ink shadow-sm'
                    : 'rounded-sm px-3 py-1 text-sm text-ink-muted hover:text-ink'
                }
              >
                {value === 'mine' ? 'Mine' : 'My team'}
              </button>
            ))}
          </div>
        )}

        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search project, task or details"
            className="pl-8"
            aria-label="Search work logs"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-auto min-w-36" aria-label="Filter by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        sort={sort}
        onSort={toggleSort}
        empty={{
          title: scope === 'team' ? 'No logs from your team yet' : 'No work logs yet',
          description:
            scope === 'team'
              ? 'Logs from people who report to you appear here.'
              : 'Record what you worked on so it is not reconstructed from memory later.',
          action:
            scope === 'mine' ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Log work
              </Button>
            ) : undefined,
        }}
        rowActions={(row) => {
          const isOwn = row.employee_id === user?.id
          const locked = row.reviewed_at != null

          return (
            <>
              {canReview && !isOwn && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Review"
                  onClick={() => setReviewing(row)}
                >
                  <MessageSquare aria-hidden />
                </Button>
              )}
              {isOwn && !locked && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Edit"
                    onClick={() => setEditing(row)}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Delete"
                    onClick={() => setDeleting(row)}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </>
          )
        }}
      />

      <WorkLogDialog log={null} open={creating} onOpenChange={setCreating} />
      <WorkLogDialog
        log={editing}
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      />
      <ReviewDialog
        log={reviewing}
        open={reviewing != null}
        onOpenChange={(open) => !open && setReviewing(null)}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this work log?"
        description={
          deleting
            ? `"${deleting.project} — ${deleting.task}" will be permanently removed. This cannot be undone.`
            : undefined
        }
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await deleteLog.mutateAsync(deleting.id)
        }}
      />
    </>
  )
}
