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
import { workLogSchema, type WorkLogFormInput } from '../schemas'
import { useCreateWorkLog, useUpdateWorkLog } from '../hooks/use-work-logs'
import type { WorkLogRow } from '../api/work-logs.api'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function WorkLogDialog({
  log,
  open,
  onOpenChange,
}: {
  log: WorkLogRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const create = useCreateWorkLog()
  const update = useUpdateWorkLog()
  const isEdit = log != null

  const form = useForm<WorkLogFormInput>({
    resolver: zodResolver(workLogSchema),
    defaultValues: {
      log_date: today(),
      project: '',
      task: '',
      description: '',
      hours: '' as unknown as number,
      status: 'submitted',
      achievement: '',
      tomorrow_plan: '',
      attachment: null,
    },
  })

  useEffect(() => {
    if (!open) return

    if (log) {
      form.reset({
        log_date: log.log_date,
        project: log.project,
        task: log.task,
        description: log.description ?? '',
        hours: log.hours,
        status: log.status === 'draft' ? 'draft' : 'submitted',
        achievement: log.achievement ?? '',
        tomorrow_plan: log.tomorrow_plan ?? '',
        attachment: log.attachment,
      })
    } else {
      form.reset({
        log_date: today(),
        project: '',
        task: '',
        description: '',
        hours: '' as unknown as number,
        status: 'submitted',
        achievement: '',
        tomorrow_plan: '',
        attachment: null,
      })
    }
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, log?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = workLogSchema.parse(values)
    if (log) await update.mutateAsync({ id: log.id, patch: parsed })
    else await create.mutateAsync(parsed)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit work log' : 'Log your work'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Once a manager reviews this log it becomes read-only.'
              : 'Record what you worked on today. Your manager can review and comment.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={create.error ?? update.error} />

            <div className="grid gap-4 sm:grid-cols-[1fr_8rem_10rem]">
              <FormField label="Date" error={form.formState.errors.log_date} required>
                {(field) => <Input {...field} {...form.register('log_date')} type="date" max={today()} />}
              </FormField>

              <FormField label="Hours" error={form.formState.errors.hours} required>
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('hours')}
                    type="number"
                    step="0.25"
                    min="0.25"
                    max="24"
                    placeholder="8"
                  />
                )}
              </FormField>

              <Controller
                control={form.control}
                name="status"
                render={({ field, fieldState }) => (
                  <FormField label="Status" error={fieldState.error} required>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={aria.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="submitted">Submit for review</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />
            </div>

            <FormField label="Project" error={form.formState.errors.project} required>
              {(field) => (
                <Input {...field} {...form.register('project')} placeholder="e.g. Q3 onboarding revamp" />
              )}
            </FormField>

            <FormField label="Task" error={form.formState.errors.task} required>
              {(field) => (
                <Input {...field} {...form.register('task')} placeholder="What did you work on?" />
              )}
            </FormField>

            <FormField label="Details" error={form.formState.errors.description}>
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('description')}
                  rows={3}
                  placeholder="Anything worth the detail — blockers, decisions, links."
                />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Today's achievement" error={form.formState.errors.achievement}>
                {(field) => (
                  <Textarea
                    {...field}
                    {...form.register('achievement')}
                    rows={2}
                    placeholder="What moved forward?"
                  />
                )}
              </FormField>

              <FormField label="Tomorrow's plan" error={form.formState.errors.tomorrow_plan}>
                {(field) => (
                  <Textarea
                    {...field}
                    {...form.register('tomorrow_plan')}
                    rows={2}
                    placeholder="What's next?"
                  />
                )}
              </FormField>
            </div>

            <Controller
              control={form.control}
              name="attachment"
              render={({ field }) => (
                <FormField
                  label="Attachment"
                  error={form.formState.errors.attachment}
                  hint="Optional — a screenshot, spec or report."
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
              {isEdit ? 'Save changes' : 'Save log'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
