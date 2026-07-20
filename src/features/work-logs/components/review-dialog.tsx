import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'
import { AttachedFile } from '@/features/storage/components/file-upload'
import { reviewSchema, type ReviewInput } from '../schemas'
import { useReviewWorkLog } from '../hooks/use-work-logs'
import type { WorkLogRow } from '../api/work-logs.api'
import { formatHours } from '@/lib/utils'
import { cn } from '@/lib/utils'

export function ReviewDialog({
  log,
  open,
  onOpenChange,
}: {
  log: WorkLogRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const review = useReviewWorkLog()

  const form = useForm<ReviewInput>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { verdict: 'reviewed', comment: '' },
  })

  useEffect(() => {
    if (open) {
      form.reset({ verdict: 'reviewed', comment: '' })
      review.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!log) return null

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = reviewSchema.parse(values)
    await review.mutateAsync({ id: log.id, verdict: parsed.verdict, comment: parsed.comment })
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Review work log</DialogTitle>
          <DialogDescription>
            {log.employee?.name} · {log.log_date} · {formatHours(log.hours)}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={review.error} />

            {/* The log itself, read-only. A reviewer cannot edit the content
                they are reviewing — the database rejects it. */}
            <div className="space-y-2 rounded border border-line bg-elevated/40 p-3 text-sm">
              <Field label="Project" value={log.project} />
              <Field label="Task" value={log.task} />
              {log.description && <Field label="Details" value={log.description} />}
              {log.achievement && <Field label="Achievement" value={log.achievement} />}
              {log.tomorrow_plan && <Field label="Tomorrow" value={log.tomorrow_plan} />}
              {log.attachment && (
                <div>
                  <p className="eyebrow mb-1">Attachment</p>
                  {/* No remove control: a reviewer must not delete the
                      evidence they were asked to review. */}
                  <AttachedFile path={log.attachment} />
                </div>
              )}
            </div>

            <Controller
              control={form.control}
              name="verdict"
              render={({ field }) => (
                <FormField label="Verdict" error={form.formState.errors.verdict} required>
                  {() => (
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['reviewed', 'Approve', 'success'],
                          ['needs_changes', 'Needs changes', 'warning'],
                        ] as const
                      ).map(([value, label, tone]) => (
                        <button
                          key={value}
                          type="button"
                          onClick={() => field.onChange(value)}
                          aria-pressed={field.value === value}
                          className={cn(
                            'rounded border px-3 py-2 text-sm font-medium transition-colors',
                            field.value === value
                              ? tone === 'success'
                                ? 'border-success/30 bg-success-soft text-success'
                                : 'border-warning/30 bg-warning-soft text-warning'
                              : 'border-line text-ink-muted hover:bg-elevated',
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </FormField>
              )}
            />

            <FormField
              label="Comment"
              error={form.formState.errors.comment}
              hint="Sent to the author as a notification."
            >
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('comment')}
                  rows={3}
                  placeholder="Optional feedback"
                />
              )}
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              Submit review
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="eyebrow">{label}</p>
      <p className="whitespace-pre-wrap text-ink">{value}</p>
    </div>
  )
}
