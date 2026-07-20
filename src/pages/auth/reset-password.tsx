import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { ShieldCheck } from 'lucide-react'
import { AuthLayout } from '@/features/auth/components/auth-layout'
import { resetPasswordSchema, type ResetPasswordInput } from '@/features/auth/schemas'
import { updatePassword } from '@/features/auth/api/auth.api'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormError, FormField } from '@/components/ui/form-field'

export function ResetPasswordPage() {
  const navigate = useNavigate()
  const [submitError, setSubmitError] = useState<unknown>(null)
  const [done, setDone] = useState(false)
  // Supabase parses the recovery token out of the URL fragment and emits
  // PASSWORD_RECOVERY. Until that lands there is no session, so the form would
  // fail — wait for it rather than letting someone submit into a 401.
  const [ready, setReady] = useState(false)
  const [invalidLink, setInvalidLink] = useState(false)

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || session != null) setReady(true)
    })

    // Cover the case where the event fired before this listener attached.
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session != null) setReady(true)
    })

    // An expired or already-used link never produces a session. Time out and
    // say so, instead of spinning forever.
    const timer = window.setTimeout(() => setInvalidLink((prev) => prev || true), 4000)

    return () => {
      subscription.unsubscribe()
      window.clearTimeout(timer)
    }
  }, [])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    try {
      await updatePassword(values.password)
      setDone(true)
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 1800)
    } catch (error) {
      setSubmitError(error)
    }
  })

  if (done) {
    return (
      <AuthLayout eyebrow="All set" title="Password updated">
        <div className="rounded-lg border border-line bg-surface p-5">
          <div className="mb-3 flex size-9 items-center justify-center rounded border border-success/25 bg-success-soft text-success">
            <ShieldCheck className="size-4" aria-hidden />
          </div>
          <p className="text-md text-ink">Your password has been changed. Taking you in…</p>
        </div>
      </AuthLayout>
    )
  }

  if (!ready && invalidLink) {
    return (
      <AuthLayout eyebrow="Link problem" title="That reset link is not valid">
        <div className="rounded-lg border border-line bg-surface p-5">
          <p className="text-md text-ink">The link has expired or has already been used.</p>
          <p className="mt-2 text-sm text-ink-muted">
            Reset links are valid for one hour and work once. Request a fresh one.
          </p>
          <Button variant="primary" size="sm" className="mt-4" asChild>
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      eyebrow="Password reset"
      title="Choose a new password"
      description="Pick something you have not used on this account before."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormError error={submitError} />

        <FormField label="New password" error={errors.password} hint="At least 8 characters." required>
          {(field) => (
            <Input
              {...field}
              {...register('password')}
              type="password"
              autoComplete="new-password"
              autoFocus
              disabled={!ready}
            />
          )}
        </FormField>

        <FormField label="Confirm new password" error={errors.confirmPassword} required>
          {(field) => (
            <Input
              {...field}
              {...register('confirmPassword')}
              type="password"
              autoComplete="new-password"
              disabled={!ready}
            />
          )}
        </FormField>

        <Button
          type="submit"
          variant="primary"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!ready}
        >
          {ready ? 'Update password' : 'Verifying link…'}
        </Button>
      </form>
    </AuthLayout>
  )
}
