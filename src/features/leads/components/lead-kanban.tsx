import { Link } from 'react-router-dom'
import { CalendarClock, IndianRupee } from 'lucide-react'
import { UserAvatar } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/states'
import type { LeadRow } from '../api/leads.api'
import { PIPELINE, PRIORITY_LABEL, PRIORITY_TONE, STATUS_LABEL } from '../constants'
import { cn } from '@/lib/utils'

/**
 * Board view of the same filtered set the table shows. Deliberately not
 * drag-and-drop: status changes here must go through the update path so the
 * trigger writes a timeline entry, and a drag that silently fails RLS is worse
 * than an explicit control. Status is changed from the detail page.
 */
export function LeadKanban({
  leads,
  isLoading,
  todayDate,
}: {
  leads: LeadRow[] | undefined
  isLoading: boolean
  todayDate?: string
}) {
  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-3">
        {PIPELINE.map((status) => (
          <div key={status} className="w-64 shrink-0 space-y-2">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ))}
      </div>
    )
  }

  if (!leads || leads.length === 0) {
    return (
      <div className="glass-flat rounded-lg">
        <EmptyState
          title="No leads match these filters"
          description="Try widening the filters, or add the first lead."
        />
      </div>
    )
  }

  const byStatus = new Map(PIPELINE.map((status) => [status, [] as LeadRow[]]))
  for (const lead of leads) byStatus.get(lead.status)?.push(lead)

  return (
    <div className="flex gap-3 overflow-x-auto pb-3">
      {PIPELINE.map((status) => {
        const column = byStatus.get(status) ?? []
        const value = column.reduce((sum, lead) => sum + Number(lead.value_estimate ?? 0), 0)

        return (
          <section key={status} className="flex w-64 shrink-0 flex-col">
            <header className="mb-2 flex items-baseline justify-between px-1">
              <h3 className="eyebrow">{STATUS_LABEL[status]}</h3>
              <span className="font-mono text-xs text-ink-subtle" data-numeric>
                {column.length}
              </span>
            </header>

            {value > 0 && (
              <p className="mb-2 px-1 font-mono text-xs text-ink-muted" data-numeric>
                ₹{value.toLocaleString('en-IN')}
              </p>
            )}

            <div className="flex flex-col gap-2">
              {column.length === 0 ? (
                <div className="rounded-lg border border-dashed border-line px-3 py-6 text-center text-xs text-ink-subtle">
                  Empty
                </div>
              ) : (
                column.map((lead) => (
                  <LeadCard key={lead.id} lead={lead} todayDate={todayDate} />
                ))
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function LeadCard({ lead, todayDate }: { lead: LeadRow; todayDate?: string }) {
  const overdue = todayDate != null && lead.next_followup != null && lead.next_followup <= todayDate

  return (
    <Link
      to={`/leads/${lead.id}`}
      className="glass-flat group rounded-lg p-3 transition-all hover:-translate-y-0.5 hover:shadow-md"
    >
      <p className="truncate font-medium text-ink group-hover:text-brand">{lead.company}</p>
      {lead.contact_name && (
        <p className="truncate text-xs text-ink-subtle">{lead.contact_name}</p>
      )}

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        <Badge tone={PRIORITY_TONE[lead.priority]}>{PRIORITY_LABEL[lead.priority]}</Badge>
        {lead.value_estimate != null && Number(lead.value_estimate) > 0 && (
          <span className="flex items-center gap-0.5 font-mono text-xs text-ink-muted" data-numeric>
            <IndianRupee className="size-2.5" aria-hidden />
            {Number(lead.value_estimate).toLocaleString('en-IN')}
          </span>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        {lead.next_followup ? (
          <span
            className={cn(
              'flex items-center gap-1 text-xs',
              overdue ? 'font-medium text-danger' : 'text-ink-subtle',
            )}
          >
            <CalendarClock className="size-3" aria-hidden />
            {new Date(`${lead.next_followup}T00:00:00`).toLocaleDateString(undefined, {
              day: 'numeric',
              month: 'short',
            })}
          </span>
        ) : (
          <span className="text-xs text-ink-subtle">No follow-up</span>
        )}

        {lead.assignee && (
          <UserAvatar name={lead.assignee.name} src={lead.assignee.profile_photo} size="xs" />
        )}
      </div>
    </Link>
  )
}
