import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CalendarClock, Columns3, List, Plus, Search } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { DataTable, type Column } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { UserAvatar } from '@/components/ui/avatar'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LeadDialog } from '@/features/leads/components/lead-dialog'
import { LeadKanban } from '@/features/leads/components/lead-kanban'
import { useFollowupsDue, useLeads } from '@/features/leads/hooks/use-leads'
import type { LeadRow } from '@/features/leads/api/leads.api'
import {
  PIPELINE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  SOURCE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from '@/features/leads/constants'
import { useEmployees } from '@/features/employees/hooks/use-employees'
import { useTodayDate } from '@/features/attendance/hooks/use-attendance'
import { useSearchParamState, useSortParam } from '@/hooks/use-search-param-state'
import { useDebounced } from '@/hooks/use-debounced'
import { cn } from '@/lib/utils'

export function LeadsPage() {
  const navigate = useNavigate()
  const { data: todayDate } = useTodayDate()
  const { data: employees } = useEmployees({ status: 'active' })

  // Every filter and the view mode live in the URL — the spec requires it, and
  // it makes "here is my pipeline" a link someone can send.
  const [view, setView] = useSearchParamState('view', 'list')
  const [status, setStatus] = useSearchParamState('status', 'all')
  const [priority, setPriority] = useSearchParamState('priority', 'all')
  const [source, setSource] = useSearchParamState('source', 'all')
  const [assignee, setAssignee] = useSearchParamState('assignee', 'all')
  const [search, setSearch] = useSearchParamState('q', '')
  const { sort, toggleSort } = useSortParam('created_at', 'desc')
  const debouncedSearch = useDebounced(search, 300)

  const { data, isLoading, error, refetch } = useLeads({
    status: status as never,
    priority: priority as never,
    source: source as never,
    assignedTo: assignee,
    search: debouncedSearch,
    sortColumn: sort.column,
    sortDirection: sort.direction,
  })

  const { data: followups } = useFollowupsDue(todayDate)
  const [creating, setCreating] = useState(false)

  const open = data?.filter((l) => l.status !== 'won' && l.status !== 'lost').length ?? 0
  const won = data?.filter((l) => l.status === 'won').length ?? 0
  const pipelineValue =
    data
      ?.filter((l) => l.status !== 'won' && l.status !== 'lost')
      .reduce((sum, l) => sum + Number(l.value_estimate ?? 0), 0) ?? 0

  const columns: ReadonlyArray<Column<LeadRow>> = [
    {
      id: 'company',
      header: 'Company',
      sortable: true,
      cell: (row) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-ink">{row.company}</p>
          {row.contact_name && <p className="truncate text-xs text-ink-subtle">{row.contact_name}</p>}
        </div>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      sortable: true,
      cell: (row) => <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>,
    },
    {
      id: 'priority',
      header: 'Priority',
      sortable: true,
      cell: (row) => <Badge tone={PRIORITY_TONE[row.priority]}>{PRIORITY_LABEL[row.priority]}</Badge>,
    },
    {
      id: 'source',
      header: 'Source',
      cell: (row) => <span className="text-ink-muted">{SOURCE_LABEL[row.source]}</span>,
    },
    {
      id: 'assignee',
      header: 'Owner',
      cell: (row) =>
        row.assignee ? (
          <div className="flex items-center gap-2">
            <UserAvatar name={row.assignee.name} src={row.assignee.profile_photo} size="xs" />
            <span className="truncate">{row.assignee.name}</span>
          </div>
        ) : (
          <span className="text-ink-subtle">Unassigned</span>
        ),
    },
    {
      id: 'value_estimate',
      header: 'Value',
      sortable: true,
      numeric: true,
      cell: (row) =>
        row.value_estimate != null && Number(row.value_estimate) > 0 ? (
          `₹${Number(row.value_estimate).toLocaleString('en-IN')}`
        ) : (
          <span className="text-ink-subtle">—</span>
        ),
    },
    {
      id: 'next_followup',
      header: 'Follow-up',
      sortable: true,
      cell: (row) => {
        if (!row.next_followup) return <span className="text-ink-subtle">—</span>
        const overdue = todayDate != null && row.next_followup <= todayDate
        return (
          <span className={cn('font-mono text-sm', overdue && 'font-medium text-danger')} data-numeric>
            {new Date(`${row.next_followup}T00:00:00`).toLocaleDateString(undefined, {
              day: '2-digit',
              month: 'short',
            })}
          </span>
        )
      },
    },
  ]

  return (
    <>
      <PageHeader
        eyebrow="Marketing"
        title="Leads"
        description="The pipeline, and what each lead is waiting on."
        actions={
          <>
            <Badge tone="neutral">{open} open</Badge>
            {won > 0 && <Badge tone="success">{won} won</Badge>}
            <Button variant="primary" onClick={() => setCreating(true)}>
              <Plus aria-hidden />
              New lead
            </Button>
          </>
        }
      />

      {followups && followups.length > 0 && (
        <Card className="mb-5 border-warning/25 bg-warning-soft">
          <CardContent className="pt-4">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <CalendarClock className="size-4 shrink-0 text-warning" aria-hidden />
              <p className="text-md font-medium text-warning">
                {followups.length} follow-{followups.length === 1 ? 'up is' : 'ups are'} due
              </p>
              <div className="flex flex-wrap gap-1.5">
                {followups.slice(0, 6).map((lead) => (
                  <button
                    key={lead.id}
                    onClick={() => navigate(`/leads/${lead.id}`)}
                    className="rounded-sm border border-warning/30 bg-surface/60 px-1.5 py-0.5 text-xs font-medium text-warning transition-colors hover:bg-surface"
                  >
                    {lead.company}
                  </button>
                ))}
                {followups.length > 6 && (
                  <span className="px-1 py-0.5 text-xs text-warning/70">
                    +{followups.length - 6} more
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {pipelineValue > 0 && (
        <p className="mb-4 text-sm text-ink-muted">
          Open pipeline value{' '}
          <span className="font-mono font-medium text-ink" data-numeric>
            ₹{pipelineValue.toLocaleString('en-IN')}
          </span>
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded border border-line bg-elevated p-0.5">
          {(
            [
              ['list', List, 'List'],
              ['board', Columns3, 'Board'],
            ] as const
          ).map(([value, Icon, label]) => (
            <button
              key={value}
              onClick={() => setView(value)}
              aria-pressed={view === value}
              aria-label={`${label} view`}
              className={cn(
                'flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-sm transition-colors',
                view === value
                  ? 'bg-surface font-medium text-ink shadow-sm'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              <Icon className="size-3.5" aria-hidden />
              {label}
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
            placeholder="Search company, contact, email or phone"
            className="pl-8"
            aria-label="Search leads"
          />
        </div>

        <Filter value={status} onChange={setStatus} label="All statuses" options={PIPELINE.map((s) => [s, STATUS_LABEL[s]])} />
        <Filter value={priority} onChange={setPriority} label="All priorities" options={Object.entries(PRIORITY_LABEL)} />
        <Filter value={source} onChange={setSource} label="All sources" options={Object.entries(SOURCE_LABEL)} />
        <Filter
          value={assignee}
          onChange={setAssignee}
          label="All owners"
          options={[
            ['unassigned', 'Unassigned'],
            ...(employees ?? []).map((e) => [e.id, e.name] as [string, string]),
          ]}
        />
      </div>

      {view === 'board' ? (
        <LeadKanban leads={data} isLoading={isLoading} todayDate={todayDate} />
      ) : (
        <DataTable
          columns={columns}
          rows={data}
          rowKey={(row) => row.id}
          isLoading={isLoading}
          error={error}
          onRetry={refetch}
          sort={sort}
          onSort={toggleSort}
          onRowClick={(row) => navigate(`/leads/${row.id}`)}
          empty={{
            title: 'No leads match these filters',
            description: 'Try widening the filters, or add the first lead.',
            action: (
              <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
                <Plus aria-hidden />
                New lead
              </Button>
            ),
          }}
        />
      )}

      <LeadDialog lead={null} open={creating} onOpenChange={setCreating} />
    </>
  )
}

function Filter({
  value,
  onChange,
  label,
  options,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  options: Array<[string, string]> | ReadonlyArray<readonly [string, string]>
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-auto min-w-32" aria-label={label}>
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">{label}</SelectItem>
        {options.map(([optionValue, optionLabel]) => (
          <SelectItem key={optionValue} value={optionValue}>
            {optionLabel}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
