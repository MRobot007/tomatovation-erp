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
import { taskSchema, type TaskFormInput } from '../schemas'
import { useCreateTask, useUpdateTask } from '../hooks/use-tasks'
import type { TaskRow } from '../api/tasks.api'
import { useEmployees } from '@/features/employees/hooks/use-employees'
import { useAuth } from '@/features/auth/auth-context'

const PRIORITIES = [
  ['low', 'Low'],
  ['medium', 'Medium'],
  ['high', 'High'],
  ['urgent', 'Urgent'],
] as const

const STATUSES = [
  ['todo', 'To do'],
  ['in_progress', 'In progress'],
  ['blocked', 'Blocked'],
  ['done', 'Done'],
  ['cancelled', 'Cancelled'],
] as const

/** Converts a stored timestamptz back into the datetime-local input format. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const date = new Date(iso)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TaskDialog({
  task,
  open,
  onOpenChange,
}: {
  task: TaskRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { data: employees } = useEmployees({ status: 'active' })
  const create = useCreateTask()
  const update = useUpdateTask()
  const isEdit = task != null

  const form = useForm<TaskFormInput>({
    resolver: zodResolver(taskSchema),
    defaultValues: {
      title: '',
      description: '',
      assigned_to: user?.id ?? '',
      priority: 'medium',
      deadline: '',
      status: 'todo',
    },
  })

  useEffect(() => {
    if (!open) return

    form.reset(
      task
        ? {
            title: task.title,
            description: task.description ?? '',
            assigned_to: task.assigned_to,
            priority: task.priority,
            deadline: toLocalInput(task.deadline),
            status: task.status,
          }
        : {
            title: '',
            description: '',
            assigned_to: user?.id ?? '',
            priority: 'medium',
            deadline: '',
            status: 'todo',
          },
    )
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, task?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = taskSchema.parse(values)
    if (task) await update.mutateAsync({ id: task.id, patch: parsed })
    else await create.mutateAsync(parsed)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit task' : 'New task'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Only the person who assigned this can change the brief. The assignee can move its status.'
              : 'Assign work to yourself or to someone who reports to you.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={create.error ?? update.error} />

            <FormField label="Title" error={form.formState.errors.title} required>
              {(field) => (
                <Input {...field} {...form.register('title')} placeholder="What needs doing?" autoFocus />
              )}
            </FormField>

            <FormField label="Description" error={form.formState.errors.description}>
              {(field) => (
                <Textarea
                  {...field}
                  {...form.register('description')}
                  rows={3}
                  placeholder="Context, links, acceptance criteria."
                />
              )}
            </FormField>

            <Controller
              control={form.control}
              name="assigned_to"
              render={({ field, fieldState }) => (
                <FormField label="Assign to" error={fieldState.error} required>
                  {(aria) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id={aria.id} aria-invalid={aria['aria-invalid']}>
                        <SelectValue placeholder="Pick someone" />
                      </SelectTrigger>
                      <SelectContent>
                        {(employees ?? []).map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                            {employee.id === user?.id ? ' (you)' : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>
              )}
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={form.control}
                name="priority"
                render={({ field, fieldState }) => (
                  <FormField label="Priority" error={fieldState.error} required>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={aria.id}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PRIORITIES.map(([value, label]) => (
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
                          {STATUSES.map(([value, label]) => (
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

              <FormField label="Deadline" error={form.formState.errors.deadline}>
                {(field) => (
                  <Input {...field} {...form.register('deadline')} type="datetime-local" />
                )}
              </FormField>
            </div>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Create task'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
