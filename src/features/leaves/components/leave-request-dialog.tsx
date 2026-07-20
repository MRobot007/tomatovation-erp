import { useEffect } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { CalendarDays } from 'lucide-react'
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
import { Input, Textarea } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileUpload } from '@/features/storage/components/file-upload'
import { leaveRequestSchema, type LeaveRequestInput } from '../schemas'
import { useRequestLeave, useUpdateLeave, useWorkingDays } from '../hooks/use-leaves'
import type { LeaveRow } from '../api/leaves.api'

export const LEAVE_TYPES = [
  ['casual', 'Casual'],
  ['sick', 'Sick'],
  ['earned', 'Earned'],
  ['unpaid', 'Unpaid'],
  ['comp_off', 'Comp off'],
  ['maternity', 'Maternity'],
  ['paternity', 'Paternity'],
] as const

export function LeaveRequestDialog({
  leave,
  open,
  onOpenChange,
}: {
  leave: LeaveRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const request = useRequestLeave()
  const update = useUpdateLeave()
  const isEdit = leave != null

  const form = useForm<LeaveRequestInput>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leave_type: 'casual',
      reason: '',
      start_date: '',
      end_date: '',
      attachment: null,
    },
  })

  const start = form.watch('start_date')
  const end = form.watch('end_date')
  const { data: workingDays } = useWorkingDays(start, end)

  useEffect(() => {
    if (!open) return
    form.reset(
      leave
        ? {
            leave_type: leave.leave_type,
            reason: leave.reason,
            start_date: leave.start_date,
            end_date: leave.end_date,
            attachment: leave.attachment,
          }
        : {
            leave_type: 'casual',
            reason: '',
            start_date: '',
            end_date: '',
            attachment: null,
          },
    )
    request.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, leave?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = leaveRequestSchema.parse(values)
    if (leave) await update.mutateAsync({ id: leave.id, patch: parsed })
    else await request.mutateAsync(parsed)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit leave request' : 'Apply for leave'}</DialogTitle>
          <DialogDescription>
            Your manager is notified straight away. You can edit or withdraw this while it is still
            pending.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            {/* Overlap rejection comes from the database, which is the only
                place that can see every other request. */}
            <FormError error={request.error ?? update.error} />

            <Controller
              control={form.control}
              name="leave_type"
              render={({ field, fieldState }) => (
                <FormField label="Type" error={fieldState.error} required>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={aria.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LEAVE_TYPES.map(([value, label]) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="From" error={form.formState.errors.start_date} required>
                {(field) => <Input {...field} {...form.register('start_date')} type="date" />}
              </FormField>

              <FormField label="To" error={form.formState.errors.end_date} required>
                {(field) => (
                  <Input {...field} {...form.register('end_date')} type="date" min={start || undefined} />
                )}
              </FormField>
            </div>

            {workingDays != null && workingDays > 0 && (
              <p className="flex items-center gap-2 rounded border border-info/25 bg-info-soft px-3 py-2 text-sm text-info">
                <CalendarDays className="size-3.5 shrink-0" aria-hidden />
                {workingDays} working {workingDays === 1 ? 'day' : 'days'}, excluding weekends.
              </p>
            )}

            <FormField label="Reason" error={form.formState.errors.reason} required>
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('reason')}
                  rows={3}
                  placeholder="A short explanation for your manager."
                />
              )}
            </FormField>

            <Controller
              control={form.control}
              name="attachment"
              render={({ field }) => (
                <FormField
                  label="Supporting document"
                  error={form.formState.errors.attachment}
                  hint="Optional — a medical note, for example. Visible to you and your manager only."
                >
                  {() => (
                    <FileUpload
                      bucket="attachments"
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                </FormField>
              )}
            />
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Submit request'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
