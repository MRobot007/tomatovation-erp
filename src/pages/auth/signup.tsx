import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { MailCheck } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { signupSchema, type SignupInput } from '@/features/auth/schemas'
import { signUp } from '@/features/auth/api/auth.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'

export function SignupPage() {
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [sentTo, setSentTo] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { name: '', email: '', password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      const result = await signUp(values)
      // With email confirmation on, there is no session yet — the user has to
      // click the link first. Say so plainly rather than silently doing nothing.
      if (result.session == null) setSentTo(values.email)
    } catch (error) {
      setSubmitError(error)
    }
  })

  if (sentTo) {
    return (
      <AuthLayout eyebrow="Almost there" title="Confirm your email">
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="mb-3 flex size-9 items-center justify-center rounded border border-success/25 bg-success-soft text-success">
            <MailCheck className="size-4" aria-hidden />
          </div>
          <p className="text-md text-ink">
            We sent a confirmation link to <strong className="font-medium">{sentTo}</strong>.
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            Click it to activate your account, then sign in. If it does not arrive within a few
            minutes, check your spam folder.
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
      eyebrow="Get started"
      title="Create your account"
      description="New accounts start with employee access. A super admin can adjust your role afterwards."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-tomato underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={submitError} />

        <FormField label="Full name" error={errors.name} required>
          {(field) => (
            <Input {...field} {...register('name')} autoComplete="name" autoFocus placeholder="Priya Sharma" />
          )}
        </FormField>

        <FormField label="Work email" error={errors.email} required>
          {(field) => (
            <Input
              {...field}
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@tomatovation.com"
            />
          )}
        </FormField>

        <FormField
          label="Password"
          error={errors.password}
          hint="At least 8 characters."
          required
        >
          {(field) => (
            <Input {...field} {...register('password')} type="password" autoComplete="new-password" />
          )}
        </FormField>

        <FormField label="Confirm password" error={errors.confirmPassword} required>
          {(field) => (
            <Input
              {...field}
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
            />
          )}
        </FormField>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Creating account' : 'Create account'}
        </Button>
      </form>
    </AuthLayout>
  )
}
