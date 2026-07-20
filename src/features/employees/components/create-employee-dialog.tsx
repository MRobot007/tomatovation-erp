import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { Check, Copy, KeyRound, TriangleAlert } from 'lucide-react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { createEmployee, type CreatedEmployee } from '../api/create-employee.api'
import { useManagerCandidates } from '../hooks/use-employees'
import { ROLE_LABELS, ROLES } from '@/lib/roles'

const schema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Name is required').max(120, 'Name is too long')),
  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().min(1, 'Email is required').email('That does not look like a valid email')),
  role: z.enum(ROLES),
  department: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(80, 'Department name is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),
  manager_id: z
    .string()
    .transform((value) => (value === 'none' || value === '' ? null : value))
    .nullable(),
})

type FormInput = z.input<typeof schema>

const EMPTY: FormInput = {
  name: '',
  email: '',
  role: 'employee',
  department: '',
  manager_id: 'none',
}

export function CreateEmployeeDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const queryClient = useQueryClient()
  const { data: managers } = useManagerCandidates()
  const [created, setCreated] = useState<CreatedEmployee | null>(null)

  const create = useMutation({
    mutationFn: createEmployee,
    onSuccess: (result) => {
      setCreated(result)
      void queryClient.invalidateQueries({ queryKey: ['employees'] })
    },
  })

  const form = useForm<FormInput>({ resolver: zodResolver(schema), defaultValues: EMPTY })

  useEffect(() => {
    if (open) {
      form.reset(EMPTY)
      create.reset()
      setCreated(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit(async (values) => {
    await create.mutateAsync(schema.parse(values))
  })

  // Success state replaces the form: the temporary password is shown once and
  // is not recoverable afterwards, so it must not be possible to click past it
  // by accident.
  if (created) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{created.name} can now sign in</DialogTitle>
            <DialogDescription>
              Send them these details. They should change the password from their profile after
              signing in.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <CopyRow label="Email" value={created.email} />
            <CopyRow label="Temporary password" value={created.temporaryPassword} mono />

            <p className="flex items-start gap-2.5 rounded border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                This password is shown once and is not stored anywhere you can read it back. If you
                lose it, they can use <strong>Forgot password</strong> on the sign-in screen.
              </span>
            </p>
          </DialogBody>

          <DialogFooter>
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add an employee</DialogTitle>
          <DialogDescription>
            Creates the account directly and returns a temporary password — no email is sent, so
            this works regardless of mail delivery.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={create.error} />

            <FormField label="Full name" error={form.formState.errors.name} required>
              {(field) => <Input {...field} {...form.register('name')} autoFocus placeholder="Priya Sharma" />}
            </FormField>

            <FormField
              label="Work email"
              error={form.formState.errors.email}
              hint="Must be on an approved company domain."
              required
            >
              {(field) => (
                <Input {...field} {...form.register('email')} type="email" placeholder="priya@tomatovation.com" />
              )}
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <Controller
                control={form.control}
                name="role"
                render={({ field, fieldState }) => (
                  <FormField label="Role" error={fieldState.error} required>
                    {(aria) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id={aria.id}>
                          <SelectValue />
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

              <FormField label="Department" error={form.formState.errors.department}>
                {(field) => <Input {...field} {...form.register('department')} placeholder="e.g. Marketing" />}
              </FormField>
            </div>

            <Controller
              control={form.control}
              name="manager_id"
              render={({ field, fieldState }) => (
                <FormField
                  label="Reports to"
                  error={fieldState.error}
                  hint="Managers can see their direct reports' attendance, work logs and leave."
                >
                  {(aria) => (
                    <Select value={field.value ?? 'none'} onValueChange={field.onChange}>
                      <SelectTrigger id={aria.id}>
                        <SelectValue placeholder="No manager" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No manager</SelectItem>
                        {(managers ?? []).map((candidate) => (
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
              <KeyRound aria-hidden />
              Create account
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function CopyRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard is unavailable over plain http or without permission; the
      // value is on screen and selectable either way.
    }
  }

  return (
    <div>
      <p className="eyebrow mb-1.5">{label}</p>
      <div className="flex items-center gap-2">
        <code
          className={`flex-1 select-all break-all rounded border border-line bg-sunken/50 px-2.5 py-2 text-sm text-ink ${
            mono ? 'font-mono' : ''
          }`}
        >
          {value}
        </code>
        <Button type="button" variant="outline" size="icon" aria-label={`Copy ${label}`} onClick={copy}>
          {copied ? <Check aria-hidden className="text-success" /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
