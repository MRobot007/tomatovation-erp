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
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'
import { DepartmentSelect } from '@/features/departments/components/department-select'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { employeeFormSchema, type EmployeeFormInput } from '../schemas'
import { useManagerCandidates, useUpdateEmployee } from '../hooks/use-employees'
import type { EmployeeRow } from '../api/employees.api'
import { ROLE_LABELS, ROLES } from '@/lib/roles'
import { useAuth } from '@/features/auth/auth-context'

const STATUS_LABELS = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
} as const

export function EmployeeEditDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { user } = useAuth()
  const { data: managers } = useManagerCandidates()
  const updateEmployee = useUpdateEmployee()

  const form = useForm<EmployeeFormInput>({
    resolver: zodResolver(employeeFormSchema),
    values: employee
      ? {
          name: employee.name,
          role: employee.role,
          department: employee.department ?? '',
          manager_id: employee.manager_id ?? 'none',
          phone: employee.phone ?? '',
          status: employee.status,
        }
      : undefined,
  })

  useEffect(() => {
    if (!open) {
      form.reset()
      updateEmployee.reset()
    }
    // Resetting on close only; re-running on every form identity change would
    // wipe input mid-edit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!employee) return null

  const isSelf = employee.id === user?.id

  const onSubmit = form.handleSubmit(async (values) => {
    const parsed = employeeFormSchema.parse(values)
    await updateEmployee.mutateAsync({ id: employee.id, patch: parsed })
    onOpenChange(false)
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit {employee.name}</DialogTitle>
          <DialogDescription>
            {employee.email} · joined {new Date(employee.created_at).toLocaleDateString()}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={updateEmployee.error} />

            {isSelf && (
              <p className="rounded border border-warning/25 bg-warning-soft px-3 py-2 text-sm text-warning">
                This is your own account. Changing your role here will immediately reduce what you
                can see — including this screen.
              </p>
            )}

            <FormField label="Full name" error={form.formState.errors.name} required>
              {(field) => <Input {...field} {...form.register('name')} />}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="role"
                render={({ field, fieldState }) => (
                  <FormField label="Role" error={fieldState.error} required>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={aria.id} aria-invalid={aria['aria-invalid']}>
                          <SelectValue placeholder="Pick a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABELS[role]}
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
                        <SelectTrigger id={aria.id} aria-invalid={aria['aria-invalid']}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(STATUS_LABELS).map(([value, label]) => (
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="department"
                render={({ field, fieldState }) => (
                  <FormField label="Department" error={fieldState.error}>
                    {(aria) => (
                      <DepartmentSelect
                        id={aria.id}
                        value={field.value === '' ? null : (field.value ?? null)}
                        onChange={(next) => field.onChange(next ?? '')}
                      />
                    )}
                  </FormField>
                )}
              />

              <FormField label="Phone" error={form.formState.errors.phone}>
                {(field) => <Input {...field} {...form.register('phone')} placeholder="+91 98765 43210" />}
              </FormField>
            </div>

            <Controller
              control={form.control}
              name="manager_id"
              render={({ field, fieldState }) => (
                <FormField
                  label="Reports to"
                  error={fieldState.error}
                  hint="Managers can see the attendance, work logs and leave of their direct reports."
                >
                  {(aria) => (
                    <Select value={field.value ?? 'none'} onValueChange={field.onChange}>
                      <SelectTrigger id={aria.id}>
                        <SelectValue placeholder="No manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No manager</SelectItem>
                        {(managers ?? [])
                          // Self-management is rejected by a CHECK constraint;
                          // hiding it avoids offering a choice that errors.
                          .filter((candidate) => candidate.id !== employee.id)
                          .map((candidate) => (
                            <SelectItem key={candidate.id} value={candidate.id}>
                              {candidate.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
