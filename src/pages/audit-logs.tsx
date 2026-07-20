import { useState } from 'react'
import { ScrollText } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuditLogs } from '@/features/admin/hooks/use-admin'
import type { AuditLogRow } from '@/features/admin/api/admin.api'
import { useEmployees } from '@/features/employees/hooks/use-employees'
import { useSearchParamState } from '@/hooks/use-search-param-state'

const ACTION_TONE = { insert: 'success', update: 'info', delete: 'danger' } as const
const ACTION_LABEL = { insert: 'Created', update: 'Updated', delete: 'Deleted' } as const

const MODULES = ['profiles', 'leaves', 'leads', 'tasks', 'app_settings'] as const

const MODULE_LABEL: Record<string, string> = {
  profiles: 'Employees',
  leaves: 'Leave',
  leads: 'Leads',
  tasks: 'Tasks',
  app_settings: 'Settings',
}

/** Fields whose change is worth surfacing in the summary column. */
const NOTABLE = ['role', 'status', 'manager_id', 'assigned_to', 'priority', 'name', 'company', 'title']

/** Human summary of what actually changed, rather than a JSON blob. */
function summarise(row: AuditLogRow): string {
  if (row.action === 'insert') return 'Record created'
  if (row.action === 'delete') return 'Record deleted'

  const before = (row.old_data ?? {}) as Record<string, unknown>
  const after = (row.new_data ?? {}) as Record<string, unknown>

  const changed = Object.keys(after).filter(
    (key) =>
      key !== 'updated_at' &&
      JSON.stringify(before[key]) !== JSON.stringify(after[key]),
  )

  if (changed.length === 0) return 'No visible change'

  const notable = changed.filter((key) => NOTABLE.includes(key))
  const shown = (notable.length > 0 ? notable : changed).slice(0, 2)

  return shown
    .map((key) => `${key}: ${format(before[key])} → ${format(after[key])}`)
    .join(', ')
    .concat(changed.length > shown.length ? `, +${changed.length - shown.length} more` : '')
}

function format(value: unknown): string {
  if (value == null) return '—'
  if (typeof value === 'string') return value.length > 24 ? `${value.slice(0, 24)}…` : value
  return String(value)
}

export function AuditLogsPage() {
  const [module, setModule] = useSearchParamState('module', 'all')
  const [action, setAction] = useSearchParamState('action', 'all')
  const [actor, setActor] = useSearchParamState('actor', 'all')
  const [from, setFrom] = useSearchParamState('from', '')
  const [to, setTo] = useSearchParamState('to', '')

  const { data: employees } = useEmployees({})
  const { data, isLoading, error, refetch } = useAuditLogs({
    module,
    action: action as never,
    userId: actor,
    from: from || undefined,
    to: to || undefined,
  })

  const [inspecting, setInspecting] = useState<AuditLogRow | null>(null)

  const columns: ReadonlyArray<Column<AuditLogRow>> = [
    {
      id: 'created_at',
      header: 'When',
      cell: (row) => (
        <span className="whitespace-nowrap font-mono text-sm" data-numeric>
          {new Date(row.created_at).toLocaleString(undefined, {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      ),
    },
    {
      id: 'actor',
      header: 'Who',
      cell: (row) =>
        row.actor ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={row.actor.name} src={row.actor.profile_photo} size="xs" />
            <span className="truncate">{row.actor.name}</span>
          </div>
        ) : (
          <span className="text-ink-subtle">System</span>
        ),
    },
    {
      id: 'action',
      header: 'Action',
      cell: (row) => <Badge tone={ACTION_TONE[row.action]}>{ACTION_LABEL[row.action]}</Badge>,
    },
    {
      id: 'module',
      header: 'Module',
      cell: (row) => (
        <span className="text-ink-muted">{MODULE_LABEL[row.module] ?? row.module}</span>
      ),
    },
    {
      id: 'summary',
      header: 'Change',
      cell: (row) => (
        <span className="line-clamp-1 font-mono text-xs text-ink-muted">{summarise(row)}</span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Audit logs"
        description="Every change to employees, leave, leads, tasks and settings. Append-only — there is no edit or delete path for these records, for anyone."
        actions={data && <Badge tone="neutral">{data.length} entries</Badge>}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={module} onValueChange={setModule}>
          <SelectTrigger className="w-auto min-w-32" aria-label="Filter by module">
            <SelectValue placeholder="All modules" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All modules</SelectItem>
            {MODULES.map((value) => (
              <SelectItem key={value} value={value}>
                {MODULE_LABEL[value]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={action} onValueChange={setAction}>
          <SelectTrigger className="w-auto min-w-32" aria-label="Filter by action">
            <SelectValue placeholder="All actions" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actions</SelectItem>
            {Object.entries(ACTION_LABEL).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={actor} onValueChange={setActor}>
          <SelectTrigger className="w-auto min-w-36" aria-label="Filter by user">
            <SelectValue placeholder="Anyone" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Anyone</SelectItem>
            {(employees ?? []).map((employee) => (
              <SelectItem key={employee.id} value={employee.id}>
                {employee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Input
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          className="w-auto"
          aria-label="From date"
        />
        <Input
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          className="w-auto"
          aria-label="To date"
        />
      </div>

      <DataTable
        columns={columns}
        rows={data}
        rowKey={(row) => row.id}
        isLoading={isLoading}
        error={error}
        onRetry={refetch}
        onRowClick={setInspecting}
        empty={{
          title: 'No audit entries match these filters',
          description: 'Changes to records appear here as they happen.',
        }}
      />

      <Dialog open={inspecting != null} onOpenChange={(open) => !open && setInspecting(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ScrollText className="size-4" aria-hidden />
              {inspecting && ACTION_LABEL[inspecting.action]}{' '}
              {inspecting && (MODULE_LABEL[inspecting.module] ?? inspecting.module)}
            </DialogTitle>
            <DialogDescription>
              {inspecting?.actor?.name ?? 'System'} ·{' '}
              {inspecting && new Date(inspecting.created_at).toLocaleString()}
            </DialogDescription>
          </DialogHeader>

          <DialogBody>
            <div className="grid gap-4 md:grid-cols-2">
              {inspecting?.old_data != null && (
                <div>
                  <p className="eyebrow mb-1.5">Before</p>
                  <pre className="max-h-80 overflow-auto rounded border border-line bg-sunken/50 p-3 font-mono text-2xs text-ink-muted">
                    {JSON.stringify(inspecting.old_data, null, 2)}
                  </pre>
                </div>
              )}
              {inspecting?.new_data != null && (
                <div>
                  <p className="eyebrow mb-1.5">After</p>
                  <pre className="max-h-80 overflow-auto rounded border border-line bg-sunken/50 p-3 font-mono text-2xs text-ink-muted">
                    {JSON.stringify(inspecting.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}
