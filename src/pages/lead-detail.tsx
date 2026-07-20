import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ArrowLeft, Mail, Pencil, Phone, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/input'
import { UserAvatar } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { FormError, FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LeadDialog } from '@/features/leads/components/lead-dialog'
import { ActivityTimeline } from '@/features/leads/components/activity-timeline'
import {
  useAddActivity,
  useDeleteLead,
  useLead,
  useLeadActivities,
  useUpdateLead,
} from '@/features/leads/hooks/use-leads'
import { activitySchema, type ActivityInput } from '@/features/leads/schemas'
import {
  PIPELINE,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  SOURCE_LABEL,
  STATUS_LABEL,
} from '@/features/leads/constants'
import type { LeadStatus } from '@/features/leads/api/leads.api'
import { useAuth } from '@/features/auth/auth-context'

export function LeadDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { role } = useAuth()
  const { data: lead, isLoading, error, refetch } = useLead(id)
  const { data: activities, isLoading: activitiesLoading } = useLeadActivities(id)
  const updateLead = useUpdateLead()
  const deleteLead = useDeleteLead()
  const addActivity = useAddActivity()

  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const form = useForm<ActivityInput>({
    resolver: zodResolver(activitySchema),
    defaultValues: { activity: 'note', remarks: '' },
  })

  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  if (!lead) {
    return (
      <ErrorState
        title="Lead not found"
        error="It may have been deleted, or you may not have access to it."
      />
    )
  }

  const onAddActivity = form.handleSubmit(async (values) => {
    const parsed = activitySchema.parse(values)
    await addActivity.mutateAsync({
      leadId: lead.id,
      activity: parsed.activity,
      remarks: parsed.remarks,
    })
    form.reset({ activity: 'note', remarks: '' })
  })

  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" asChild>
        <Link to="/leads">
          <ArrowLeft aria-hidden />
          All leads
        </Link>
      </Button>

      <PageHeader
        eyebrow={SOURCE_LABEL[lead.source]}
        title={lead.company}
        description={lead.contact_name ?? undefined}
        actions={
          <>
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil aria-hidden />
              Edit
            </Button>
            {role === 'super_admin' && (
              <Button variant="ghost" size="icon" aria-label="Delete lead" onClick={() => setDeleting(true)}>
                <Trash2 aria-hidden />
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-5">
          <Card>
            <CardHeader>
              <CardTitle>Add to timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={onAddActivity} className="space-y-3">
                <FormError error={addActivity.error} />

                <div className="flex flex-wrap gap-3">
                  <Controller
                    control={form.control}
                    name="activity"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className="w-36" aria-label="Activity type">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="note">Note</SelectItem>
                          <SelectItem value="call">Call</SelectItem>
                          <SelectItem value="email">Email</SelectItem>
                          <SelectItem value="meeting">Meeting</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <FormField label="What happened?" error={form.formState.errors.remarks}>
                  {(field) => (
                    <Textarea
                      {...field}
                      {...form.register('remarks')}
                      rows={2}
                      placeholder="Spoke with the CFO, sending a revised quote Thursday."
                    />
                  )}
                </FormField>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={form.formState.isSubmitting}
                >
                  Add entry
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline activities={activities} isLoading={activitiesLoading} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-3 pt-5">
              <div>
                <p className="eyebrow mb-1.5">Status</p>
                {/* Changing status here fires the trigger that appends a
                    timeline entry — no client-side logging needed. */}
                <Select
                  value={lead.status}
                  onValueChange={(value) =>
                    updateLead.mutate({ id: lead.id, patch: { status: value as LeadStatus } })
                  }
                >
                  <SelectTrigger aria-label="Lead status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PIPELINE.map((status) => (
                      <SelectItem key={status} value={status}>
                        {STATUS_LABEL[status]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Detail label="Priority">
                <Badge tone={PRIORITY_TONE[lead.priority]}>{PRIORITY_LABEL[lead.priority]}</Badge>
              </Detail>

              <Detail label="Owner">
                {lead.assignee ? (
                  <div className="flex items-center gap-2">
                    <UserAvatar name={lead.assignee.name} src={lead.assignee.profile_photo} size="xs" />
                    <span className="text-sm text-ink">{lead.assignee.name}</span>
                  </div>
                ) : (
                  <span className="text-sm text-ink-subtle">Unassigned</span>
                )}
              </Detail>

              {lead.value_estimate != null && Number(lead.value_estimate) > 0 && (
                <Detail label="Value estimate">
                  <span className="font-mono text-md font-medium text-ink" data-numeric>
                    ₹{Number(lead.value_estimate).toLocaleString('en-IN')}
                  </span>
                </Detail>
              )}

              {lead.next_followup && (
                <Detail label="Next follow-up">
                  <span className="font-mono text-sm text-ink" data-numeric>
                    {new Date(`${lead.next_followup}T00:00:00`).toLocaleDateString(undefined, {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </Detail>
              )}
            </CardContent>
          </Card>

          {(lead.phone || lead.email) && (
            <Card>
              <CardContent className="space-y-2 pt-5">
                <p className="eyebrow mb-1">Contact</p>
                {lead.phone && (
                  <a
                    href={`tel:${lead.phone}`}
                    className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-tomato"
                  >
                    <Phone className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate font-mono">{lead.phone}</span>
                  </a>
                )}
                {lead.email && (
                  <a
                    href={`mailto:${lead.email}`}
                    className="flex items-center gap-2 text-sm text-ink-muted transition-colors hover:text-tomato"
                  >
                    <Mail className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{lead.email}</span>
                  </a>
                )}
              </CardContent>
            </Card>
          )}

          {lead.remarks && (
            <Card>
              <CardContent className="pt-5">
                <p className="eyebrow mb-1.5">Remarks</p>
                <p className="whitespace-pre-wrap text-sm text-ink-muted">{lead.remarks}</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <LeadDialog lead={lead} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${lead.company}?`}
        description="The lead and its entire activity timeline are permanently removed. This cannot be undone."
        confirmLabel="Delete lead"
        destructive
        onConfirm={async () => {
          await deleteLead.mutateAsync(lead.id)
          window.location.href = '/leads'
        }}
      />
    </>
  )
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="eyebrow mb-1">{label}</p>
      {children}
    </div>
  )
}
