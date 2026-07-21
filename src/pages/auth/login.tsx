import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { loginSchema, type LoginInput } from '@/features/auth/schemas'
import { signIn } from '@/features/auth/api/auth.api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'

export function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPassword, setShowPassword] = useState(false)
  const [submitError, setSubmitError] = useState<unknown>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', remember: true },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await signIn(values)
      // Return them to whatever they were trying to reach before the redirect.
      // Falling back to "/" rather than a fixed screen: the index route decides
      // by role, so managers and employees land somewhere useful without this
      // file needing to know the rule.
      const from = (location.state as { from?: { pathname?: string } } | null)?.from
      navigate(from?.pathname ?? '/', { replace: true })
    } catch (error) {
      setSubmitError(error)
    }
  })

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Sign in to Tomatovation"
      description="Use the email address your workspace was set up with."
      footer={
        // No "create an account" link: accounts are provisioned by a super
        // admin, and self-signup is closed at the database (migration 0026).
        // Offering it here would only lead to a refusal.
        <>Need an account? Ask a super admin to set one up for you.</>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={submitError} />

        <FormField label="Email" error={errors.email} required>
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

        <FormField label="Password" error={errors.password} required>
          {(field) => (
            <div className="relative">
              <Input
                {...field}
                {...register('password')}
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                className="pr-9"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-ink-subtle transition-colors hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
        </FormField>

        <div className="flex items-center justify-between">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-muted">
            <input
              type="checkbox"
              {...register('remember')}
              className="size-3.5 rounded-sm border-line-strong text-tomato focus:ring-tomato/40"
            />
            Keep me signed in
          </label>

          <Link
            to="/forgot-password"
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="primary" size="lg" className="w-full" loading={isSubmitting}>
          {isSubmitting ? 'Signing in' : 'Sign in'}
        </Button>
      </form>
    </AuthLayout>
  )
}
