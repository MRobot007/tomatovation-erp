import { useEffect } from 'react'
import { useForm, Controller, type Control } from 'react-hook-form'
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
import { leadSchema, type LeadFormInput } from '../schemas'
import { useCreateLead, useUpdateLead } from '../hooks/use-leads'
import type { LeadRow } from '../api/leads.api'
import { PIPELINE, PRIORITY_LABEL, SOURCE_LABEL, STATUS_LABEL } from '../constants'
import { useEmployees } from '@/features/employees/hooks/use-employees'

const EMPTY: LeadFormInput = {
  company: '',
  contact_name: '',
  phone: '',
  email: '',
  source: 'other',
  status: 'new',
  priority: 'medium',
  assigned_to: 'none',
  value_estimate: '',
  next_followup: '',
  remarks: '',
}

export function LeadDialog({
  lead,
  open,
  onOpenChange,
}: {
  lead: LeadRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: employees } = useEmployees({ status: 'active' })
  const create = useCreateLead()
  const update = useUpdateLead()
  const isEdit = lead != null

  const form = useForm<LeadFormInput>({ resolver: zodResolver(leadSchema), defaultValues: EMPTY })

  useEffect(() => {
    if (!open) return
    form.reset(
      lead
        ? {
            company: lead.company,
            contact_name: lead.contact_name ?? '',
            phone: lead.phone ?? '',
            email: lead.email ?? '',
            source: lead.source,
            status: lead.status,
            priority: lead.priority,
            assigned_to: lead.assigned_to ?? 'none',
            value_estimate: lead.value_estimate ?? '',
            next_followup: lead.next_followup ?? '',
            remarks: lead.remarks ?? '',
          }
        : EMPTY,
    )
    create.reset()
    update.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, lead?.id])

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = leadSchema.parse(values)
    if (lead) await update.mutateAsync({ id: lead.id, patch: parsed })
    else await create.mutateAsync(parsed)
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${lead.company}` : 'New lead'}</DialogTitle>
          <DialogDescription>
            Status and assignment changes are recorded on the lead's timeline automatically.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={create.error ?? update.error} />

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Company" error={form.formState.errors.company} required>
                {(field) => <Input {...field} {...form.register('company')} autoFocus />}
              </FormField>

              <FormField label="Contact name" error={form.formState.errors.contact_name}>
                {(field) => <Input {...field} {...form.register('contact_name')} />}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Phone" error={form.formState.errors.phone}>
                {(field) => <Input {...field} {...form.register('phone')} placeholder="+91 98765 43210" />}
              </FormField>

              <FormField label="Email" error={form.formState.errors.email}>
                {(field) => <Input {...field} {...form.register('email')} type="email" />}
              </FormField>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <SelectField
                control={form.control}
                name="status"
                label="Status"
                options={PIPELINE.map((s) => [s, STATUS_LABEL[s]])}
              />
              <SelectField
                control={form.control}
                name="priority"
                label="Priority"
                options={Object.entries(PRIORITY_LABEL)}
              />
              <SelectField
                control={form.control}
                name="source"
                label="Source"
                options={Object.entries(SOURCE_LABEL)}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <Controller
                control={form.control}
                name="assigned_to"
                render={({ field, fieldState }) => (
                  <FormField label="Assigned to" error={fieldState.error}>
                    {(aria) => (
                      <Select value={field.value ?? 'none'} onValueChange={field.onChange}>
                        <SelectTrigger id={aria.id}>
                          <SelectValue placeholder="Unassigned" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {(employees ?? []).map((employee) => (
                            <SelectItem key={employee.id} value={employee.id}>
                              {employee.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </FormField>
                )}
              />

              <FormField label="Next follow-up" error={form.formState.errors.next_followup}>
                {(field) => <Input {...field} {...form.register('next_followup')} type="date" />}
              </FormField>

              <FormField label="Value estimate" error={form.formState.errors.value_estimate}>
                {(field) => (
                  <Input
                    {...field}
                    {...form.register('value_estimate')}
                    type="number"
                    min="0"
                    step="1000"
                    placeholder="0"
                  />
                )}
              </FormField>
            </div>

            <FormField label="Remarks" error={form.formState.errors.remarks}>
              {(field) => (
                <Textarea {...field} {...form.register('remarks')} rows={3} placeholder="Context and notes." />
              )}
            </FormField>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              {isEdit ? 'Save changes' : 'Create lead'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Small wrapper — this dialog has three near-identical enum selects. */
function SelectField({
  control,
  name,
  label,
  options,
}: {
  control: Control<LeadFormInput>
  name: 'status' | 'priority' | 'source'
  label: string
  options: Array<[string, string]> | ReadonlyArray<readonly [string, string]>
}) {
  return (
    <Controller
      control={control}
      name={name}
      render={({ field, fieldState }) => (
        <FormField label={label} error={fieldState.error} required>
          {(aria) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id={aria.id}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map(([value, optionLabel]) => (
                  <SelectItem key={value} value={value}>
                    {optionLabel}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>
      )}
    />
  )
}
