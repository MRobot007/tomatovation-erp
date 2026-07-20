import { useState } from 'react'
import { AlertTriangle, Pencil, Plus, Search, Trash2 } from 'lucide-react'
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
import { TaskDialog } from '@/features/tasks/components/task-dialog'
import { useDeleteTask, useSetTaskStatus, useTasks } from '@/features/tasks/hooks/use-tasks'
import type { TaskRow, TaskStatus } from '@/features/tasks/api/tasks.api'
import { useSearchParamState, useSortParam } from '@/hooks/use-search-param-state'
import { useDebounced } from '@/hooks/use-debounced'
import { useAuth } from '@/features/auth/auth-context'
import { cn } from '@/lib/utils'

const PRIORITY_TONE = { low: 'neutral', medium: 'info', high: 'warning', urgent: 'danger' } as const
const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' } as const

const STATUS_TONE = {
  todo: 'neutral',
  in_progress: 'brand',
  blocked: 'danger',
  done: 'success',
  cancelled: 'neutral',
} as const

const STATUS_LABEL = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
  cancelled: 'Cancelled',
} as const

/** Open tasks only — a deadline that has passed on a finished task is noise. */
function isOverdue(task: TaskRow): boolean {
  if (!task.deadline || task.status === 'done' || task.status === 'cancelled') return false
  return new Date(task.deadline) < new Date()
}

function formatDeadline(value: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  const today = new Date()
  const sameYear = date.getFullYear() === today.getFullYear()
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function TasksPage() {
  const { user } = useAuth()
  const [scope, setScope] = useSearchParamState('scope', 'mine')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const [priority, setPriority] = useSearchParamState('priority', 'all')
  const [search, setSearch] = useSearchParamState('q', '')
  const { sort, toggleSort } = useSortParam('deadline', 'asc')
  const debouncedSearch = useDebounced(search, 300)

  const { data, isLoading, error, refetch } = useTasks({
    assignedTo: scope === 'mine' ? user?.id : undefined,
    status: status as never,
    priority: priority as never,
    search: debouncedSearch,
    sortColumn: sort.column,
    sortDirection: sort.direction,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<TaskRow | null>(null)
  const [deleting, setDeleting] = useState<TaskRow | null>(null)
  const setTaskStatus = useSetTaskStatus()
  const deleteTask = useDeleteTask()

  const open = data?.filter((t) => t.status !== 'done' && t.status !== 'cancelled').length ?? 0
  const overdue = data?.filter(isOverdue).length ?? 0

  const columns: ReadonlyArray<Column<TaskRow>> = [
    {
      id: 'title',
      header: 'Task',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p
            className={cn(
              'truncate font-medium',
              row.status === 'done' || row.status === 'cancelled'
                ? 'text-ink-subtle line-through'
                : 'text-ink',
            )}
          >
            {row.title}
          </p>
          {row.assigner && row.assigner.id !== row.assigned_to && (
            <p className="truncate text-xs text-ink-subtle">from {row.assigner.name}</p>
          )}
        </div>
      ),
    },
    ...(scope === 'team'
      ? [
          {
            id: 'assignee',
            header: 'Assignee',
            cell: (row: TaskRow) => (
              <div className="flex items-center gap-2">
                <UserAvatar name={row.assignee?.name} src={row.assignee?.profile_photo} size="xs" />
                <span className="truncate">{row.assignee?.name ?? 'Unknown'}</span>
              </div>
            ),
          } satisfies Column<TaskRow>,
        ]
      : []),
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      cell: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Badge>,
    },
    {
      id: 'deadline',
      header: 'Deadline',
      sortable: true,
      cell: (row) => (
        <span
          className={cn('flex items-center gap-1.5 font-mono text-sm', isOverdue(row) && 'text-danger')}
          data-numeric
        >
          {isOverdue(row) && <AlertTriangle className="size-3" aria-label="Overdue" />}
          {formatDeadline(row.deadline)}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => {
        const canChange = row.assigned_to === user?.id || row.assigned_by === user?.id
        if (!canChange) return <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>

        // Inline status change — the single most common action on this screen,
        // so it does not deserve a dialog.
        return (
          <Select
            value={row.status}
            onValueChange={(value) => setTaskStatus.mutate({ id: row.id, status: value as TaskStatus })}
          >
            <SelectTrigger className="h-7 w-auto min-w-28 border-transparent bg-transparent px-1.5 shadow-none hover:border-line-strong hover:bg-sunken/50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_LABEL).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Daily"
        title="Tasks"
        description="Assigned work, with the deadline and priority that came with it."
        actions={
          <>
            {overdue > 0 && <Badge tone="danger" dot>{overdue} overdue</Badge>}
            <Badge tone="neutral">{open} open</Badge>
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New task
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
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
              {value === 'mine' ? 'Assigned to me' : 'All visible'}
            </button>
          ))}
        </div>

        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-subtle"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search tasks"
            className="pl-8"
            aria-label="Search tasks"
          />
        </div>

        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-auto min-w-32" aria-label="Filter by status">
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

        <Select value={priority} onValueChange={setPriority}>
          <SelectTrigger className="w-auto min-w-32" aria-label="Filter by priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
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
          title: scope === 'mine' ? 'Nothing assigned to you' : 'No tasks yet',
          description: 'Tasks assigned to you, or that you assign to others, appear here.',
          action: (
            <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New task
            </Button>
          ),
        }}
        rowActions={(row) => {
          const isAssigner = row.assigned_by === user?.id
          if (!isAssigner) return null
          return (
            <>
              <Button variant="ghost" size="icon-sm" aria-label="Edit" onClick={() => setEditing(row)}>
                <Pencil aria-hidden />
              </Button>
              <Button variant="ghost" size="icon-sm" aria-label="Delete" onClick={() => setDeleting(row)}>
                <Trash2 aria-hidden />
              </Button>
            </>
          )
        }}
      />

      <TaskDialog task={null} open={creating} onOpenChange={setCreating} />
      <TaskDialog
        task={editing}
        open={editing != null}
        onOpenChange={(value) => !value && setEditing(null)}
      />

      <ConfirmDialog
        open={deleting != null}
        onOpenChange={(value) => !value && setDeleting(null)}
        title="Delete this task?"
        description={deleting ? `"${deleting.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        destructive
        onConfirm={async () => {
          if (deleting) await deleteTask.mutateAsync(deleting.id)
        }}
      />
    </>
  )
}
