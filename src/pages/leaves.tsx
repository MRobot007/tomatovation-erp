import { useState } from 'react'
import { Check, Pencil, Plus, X } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
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
import {
  LeaveRequestDialog,
  LEAVE_TYPES,
} from '@/features/leaves/components/leave-request-dialog'
import { AttachmentBadge } from '@/features/storage/components/file-upload'
import { useCancelLeave, useDecideLeave, useLeaves } from '@/features/leaves/hooks/use-leaves'
import type { LeaveRow } from '@/features/leaves/api/leaves.api'
import { useSearchParamState, useSortParam } from '@/hooks/use-search-param-state'
import { useAuth } from '@/features/auth/auth-context'
import { atLeast } from '@/lib/roles'

const STATUS_TONE = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
  cancelled: 'neutral',
} as const

const STATUS_LABEL = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Withdrawn',
} as const

const TYPE_LABEL = Object.fromEntries(LEAVE_TYPES) as Record<string, string>

function formatRange(start: string, end: string): string {
  const from = new Date(`${start}T00:00:00`)
  const to = new Date(`${end}T00:00:00`)
  const opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }

  if (start === end) return from.toLocaleDateString(undefined, opts)
  return `${from.toLocaleDateString(undefined, opts)} – ${to.toLocaleDateString(undefined, opts)}`
}

function dayCount(start: string, end: string): number {
  const ms = new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()
  return Math.round(ms / 86_400_000) + 1
}

export function LeavesPage() {
  const { user, role } = useAuth()
  const canApprove = atLeast(role, 'manager')

  const [scope, setScope] = useSearchParamState('scope', 'mine')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const { sort, toggleSort } = useSortParam('start_date', 'desc')

  const { data, isLoading, error, refetch } = useLeaves({
    employeeId: scope === 'mine' ? user?.id : undefined,
    status: status as never,
    sortColumn: sort.column,
    sortDirection: sort.direction,
  })

  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<LeaveRow | null>(null)
  const [deciding, setDeciding] = useState<{ leave: LeaveRow; verdict: 'approved' | 'rejected' } | null>(
    null,
  )
  const [cancelling, setCancelling] = useState<LeaveRow | null>(null)

  const decide = useDecideLeave()
  const cancel = useCancelLeave()

  const pending = data?.filter((row) => row.status === 'pending').length ?? 0

  const columns: ReadonlyArray<Column<LeaveRow>> = [
    ...(scope === 'team'
      ? [
          {
            id: 'employee',
            header: 'Employee',
            cell: (row: LeaveRow) => (
              <div className="flex items-center gap-2">
                <UserAvatar name={row.employee?.name} src={row.employee?.profile_photo} size="xs" />
                <span className="truncate">{row.employee?.name ?? 'Unknown'}</span>
              </div>
            ),
          } satisfies Column<LeaveRow>,
        ]
      : []),
    {
      id: 'leave_type',
      header: 'Type',
      sortable: true,
      cell: (row) => <Badge tone="neutral">{TYPE_LABEL[row.leave_type] ?? row.leave_type}</Badge>,
    },
    {
      id: 'start_date',
      header: 'Dates',
      sortable: true,
      cell: (row) => (
        <div>
          <p className="font-medium text-ink">{formatRange(row.start_date, row.end_date)}</p>
          <p className="text-xs text-ink-subtle">
            {dayCount(row.start_date, row.end_date)}{' '}
            {dayCount(row.start_date, row.end_date) === 1 ? 'day' : 'days'}
          </p>
        </div>
      ),
    },
    {
      id: 'reason',
      header: 'Reason',
      cell: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="line-clamp-1 text-ink-muted">{row.reason}</span>
          <AttachmentBadge path={row.attachment} />
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => (
        <div>
          <Badge tone={STATUS_TONE[row.status]} dot={row.status === 'pending'}>
            {STATUS_LABEL[row.status]}
          </Badge>
          {row.approver && (
            <p className="mt-0.5 text-xs text-ink-subtle">by {row.approver.name}</p>
          )}
        </div>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Daily"
        title="Leave"
        description="Requests are checked against your existing approved leave before they are accepted."
        actions={
          <>
            {canApprove && pending > 0 && scope === 'team' && (
              <Badge tone="warning" dot>
                {pending} awaiting you
              </Badge>
            )}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              Apply for leave
            </Button>
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {canApprove && (
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
                {value === 'mine' ? 'My leave' : 'To approve'}
              </button>
            ))}
          </div>
        )}

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
          title: scope === 'team' ? 'Nothing to approve' : 'No leave requests yet',
          description:
            scope === 'team'
              ? 'Requests from people who report to you appear here.'
              : 'Apply for leave and your manager will be notified.',
          action:
            scope === 'mine' ? (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                Apply for leave
              </Button>
            ) : undefined,
        }}
        rowActions={(row) => {
          const isOwn = row.employee_id === user?.id
          const isPending = row.status === 'pending'

          return (
            <>
              {/* Self-approval is blocked in the database for every role, so the
                  buttons are hidden rather than shown and then rejected. */}
              {canApprove && !isOwn && isPending && (
                <>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Approve"
                    onClick={() => setDeciding({ leave: row, verdict: 'approved' })}
                  >
                    <Check aria-hidden className="text-success" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label="Reject"
                    onClick={() => setDeciding({ leave: row, verdict: 'rejected' })}
                  >
                    <X aria-hidden className="text-danger" />
                  </Button>
                </>
              )}
              {isOwn && isPending && (
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
                    aria-label="Withdraw"
                    onClick={() => setCancelling(row)}
                  >
                    <X aria-hidden />
                  </Button>
                </>
              )}
            </>
          )
        }}
      />

      <LeaveRequestDialog leave={null} open={creating} onOpenChange={setCreating} />
      <LeaveRequestDialog
        leave={editing}
        open={editing != null}
        onOpenChange={(open) => !open && setEditing(null)}
      />

      <ConfirmDialog
        open={deciding != null}
        onOpenChange={(open) => !open && setDeciding(null)}
        title={
          deciding
            ? `${deciding.verdict === 'approved' ? 'Approve' : 'Reject'} ${deciding.leave.employee?.name}'s leave?`
            : ''
        }
        description={
          deciding
            ? `${TYPE_LABEL[deciding.leave.leave_type]} leave, ${formatRange(deciding.leave.start_date, deciding.leave.end_date)}. They are notified immediately.`
            : undefined
        }
        confirmLabel={deciding?.verdict === 'approved' ? 'Approve' : 'Reject'}
        destructive={deciding?.verdict === 'rejected'}
        onConfirm={async () => {
          if (deciding) {
            await decide.mutateAsync({
              id: deciding.leave.id,
              status: deciding.verdict,
              note: null,
            })
          }
        }}
      />

      <ConfirmDialog
        open={cancelling != null}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Withdraw this request?"
        description="It will no longer be visible to your manager for approval. You can submit a new request for the same dates afterwards."
        confirmLabel="Withdraw"
        destructive
        onConfirm={async () => {
          if (cancelling) await cancel.mutateAsync(cancelling.id)
        }}
      />
    </>
  )
}
