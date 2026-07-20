import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { forgotPasswordSchema, type ForgotPasswordInput } from '@/features/auth/schemas'
import { requestPasswordReset } from '@/features/auth/api/auth.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'

export function ForgotPasswordPage() {
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [sent, setSent] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await requestPasswordReset(values.email)
      setSent(true)
    } catch (error) {
      setSubmitError(error)
    }
  })

  if (sent) {
    return (
      <AuthLayout eyebrow="Check your inbox" title="Reset link sent">
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="mb-3 flex size-9 items-center justify-center rounded border border-success/25 bg-success-soft text-success">
            <MailCheck className="size-4" aria-hidden />
          </div>
          <p className="text-md text-ink">
            If an account exists for that address, a reset link is on its way.
          </p>
          {/* Deliberately not confirming whether the address is registered —
              that would let anyone enumerate which staff have accounts. */}
          <p className="mt-2 text-sm text-ink-muted">
            The link expires in one hour. If it does not arrive, check your spam folder or try
            again.
          </p>
          <Button variant="outline" size="sm" className="mt-4" asChild>
            <Link to="/login">Back to sign in</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Password reset"
      title="Forgot your password?"
      description="Enter your work email and we will send you a link to set a new one."
      footer={
        <>
          Remembered it?{' '}
          <Link to="/login" className="font-medium text-tomato underline-offset-4 hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={submitError} />

        <FormField label="Work email" error={errors.email} required>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              autoComplete="email"
              autoFocus
              placeholder="you@tomatovation.com"
            />
          )}
        </FormField>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Sending' : 'Send reset link'}
        </Button>
      </form>
    </AuthLayout>
  )
}
