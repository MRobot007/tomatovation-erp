import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { z } from 'zod'
import { Eye, EyeOff, KeyRound, TriangleAlert } from 'lucide-react'
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
import { CopyRow } from '@/components/ui/copy-row'
import { FormError, FormField } from '@/components/ui/form-field'
import { resetEmployeePassword, type ResetPasswordResult } from '../api/create-employee.api'
import type { EmployeeRow } from '../api/employees.api'

/**
 * Blank means "generate one", which is the default and the better answer — a
 * password an admin invents on the spot is one they can guess, and it tends to
 * be the same one for everybody.
 */
const schema = z.object({
  password: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .refine((value) => value === '' || value.length >= 8, 'Use at least 8 characters')
        .refine((value) => value.length <= 72, 'Passwords are limited to 72 characters'),
    ),
})

type FormInput = z.input<typeof schema>

export function ResetPasswordDialog({
  employee,
  open,
  onOpenChange,
}: {
  employee: EmployeeRow | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [done, setDone] = useState<ResetPasswordResult | null>(null)
  const [visible, setVisible] = useState(false)

  const reset = useMutation({
    mutationFn: resetEmployeePassword,
    onSuccess: setDone,
  })

  const form = useForm<FormInput>({ resolver: zodResolver(schema), defaultValues: { password: '' } })

  useEffect(() => {
    if (open) {
      form.reset({ password: '' })
      reset.reset()
      setDone(null)
      setVisible(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const onSubmit = form.handleSubmit(async (values) => {
    if (!employee) return
    const password = values.password.trim()
    await reset.mutateAsync({ user_id: employee.id, ...(password ? { password } : {}) })
  })

  // Success replaces the form: the password is shown once and cannot be read
  // back afterwards, so it must not be possible to click past it by accident.
  if (done) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{done.name}&rsquo;s password has been changed</DialogTitle>
            <DialogDescription>
              Send them these details. They should change it from their profile once they are in.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="space-y-4">
            <CopyRow label="Email" value={done.email} />
            <CopyRow label="New password" value={done.temporaryPassword} mono />

            <p className="flex items-start gap-2.5 rounded border border-warning/25 bg-warning-soft px-3 py-2.5 text-sm text-warning">
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              <span>
                Shown once and not stored anywhere you can read it back. If you lose it, reset it
                again. Any session {done.name.split(' ')[0]} already had stays signed in until it
                expires.
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
          <DialogTitle>Reset {employee?.name}&rsquo;s password</DialogTitle>
          <DialogDescription>
            Sets a new password without needing the old one — for when someone is locked out and
            the forgot-password email is not reaching them.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit}>
          <DialogBody className="space-y-4">
            <FormError error={reset.error} />

            <FormField
              label="New password"
              error={form.formState.errors.password}
              hint="Leave blank to generate a strong one — recommended."
            >
              {(field) => (
                <div className="relative">
                  <Input
                    {...field}
                    {...form.register('password')}
                    type={visible ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Generate one for me"
                    className="pr-9"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible((shown) => !shown)}
                    className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-subtle transition-colors hover:text-ink"
                    aria-label={visible ? 'Hide password' : 'Show password'}
                  >
                    {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
              )}
            </FormField>

            <p className="text-sm text-ink-muted">
              This is recorded in the audit log against your account.
            </p>
          </DialogBody>

          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
              <KeyRound aria-hidden />
              Reset password
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
