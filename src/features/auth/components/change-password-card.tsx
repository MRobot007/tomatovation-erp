import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, KeyRound } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'
import { changePasswordSchema, type ChangePasswordInput } from '../schemas'
import { changePassword } from '../api/auth.api'

/**
 * Password change for a signed-in user.
 *
 * The current password is required. Supabase would accept the change without
 * it — a live session is enough — which makes an unattended laptop sufficient
 * to lock the real owner out of their own account.
 */
export function ChangePasswordCard() {
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  const [visible, setVisible] = useState(false)

  const form = useForm<ChangePasswordInput>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const onSubmit = form.handleSubmit(async (values) => {
    setSubmitError(null)
    setDone(false)

    try {
      await changePassword(values.currentPassword, values.newPassword)
      form.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
      setDone(true)
      window.setTimeout(() => setDone(false), 6000)
    } catch (error) {
      setSubmitError(error)
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-ink-subtle" aria-hidden />
          Password
        </CardTitle>
        <CardDescription>
          Changing your password signs you out everywhere else. This device stays signed in.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <FormError error={submitError} />

          {done && (
            <p
              role="status"
              className="flex items-center gap-2 rounded border border-success/25 bg-success-soft px-3 py-2 text-sm text-success"
            >
              <Check className="size-3.5 shrink-0" aria-hidden />
              Password updated. Other devices have been signed out.
            </p>
          )}

          <FormField label="Current password" error={form.formState.errors.currentPassword} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('currentPassword')}
                type="password"
                autoComplete="current-password"
              />
            )}
          </FormField>

          <FormField
            label="New password"
            error={form.formState.errors.newPassword}
            hint="At least 8 characters."
            required
          >
            {(field) => (
              <div className="relative">
                <Input
                  {...field}
                  {...form.register('newPassword')}
                  type={visible ? 'text' : 'password'}
                  autoComplete="new-password"
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

          <FormField label="Confirm new password" error={form.formState.errors.confirmPassword} required>
            {(field) => (
              <Input
                {...field}
                {...form.register('confirmPassword')}
                type={visible ? 'text' : 'password'}
                autoComplete="new-password"
              />
            )}
          </FormField>

          <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
            Update password
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
