import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { AvatarUpload } from '@/features/storage/components/avatar-upload'
import { ChangePasswordCard } from '@/features/auth/components/change-password-card'
import { FormError, FormField } from '@/components/ui/form-field'
import { useAuth } from '@/features/auth/auth-context'
import { useUpdateEmployee } from '@/features/employees/hooks/use-employees'
import { ownProfileSchema, type OwnProfileInput } from '@/features/employees/schemas'
import { ROLE_LABELS } from '@/lib/roles'

/**
 * Completion is a nudge, not a gate. Each field is weighted equally and the
 * bar disappears at 100% rather than sitting there as permanent clutter.
 */
function completion(profile: { name: string; phone: string | null; department: string | null; profile_photo: string | null }) {
  const fields = [profile.name, profile.phone, profile.department, profile.profile_photo]
  const filled = fields.filter((value) => Boolean(value?.toString().trim())).length
  return Math.round((filled / fields.length) * 100)
}

export function ProfilePage() {
  const { profile, role, refetchProfile } = useAuth()
  const updateEmployee = useUpdateEmployee()
  const [saved, setSaved] = useState(false)

  const form = useForm<OwnProfileInput>({
    resolver: zodResolver(ownProfileSchema),
    values: profile
      ? {
          name: profile.name,
          phone: profile.phone ?? '',
          department: profile.department ?? '',
        }
      : undefined,
  })

  if (!profile) return null

  const percent = completion(profile)

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false)
    const parsed = ownProfileSchema.parse(values)
    await updateEmployee.mutateAsync({ id: profile.id, patch: parsed })
    refetchProfile()
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  })

  return (
    <>
      <PageHeader eyebrow="Workspace" title="My profile" />

      <div className="grid gap-5 lg:grid-cols-[20rem_1fr]">
        <div className="space-y-4">
          <Card>
            <CardContent className="flex flex-col items-center pt-6 text-center">
              <AvatarUpload />
              <p className="mt-3 font-display text-lg font-semibold tracking-tight text-ink">
                {profile.name}
              </p>
              <p className="text-sm text-ink-muted">{profile.email}</p>
              {role && (
                <Badge tone="brand" className="mt-3">
                  {ROLE_LABELS[role]}
                </Badge>
              )}
            </CardContent>
          </Card>

          {percent < 100 && (
            <Card>
              <CardContent className="pt-5">
                <div className="mb-2 flex items-baseline justify-between">
                  <p className="eyebrow">Profile completion</p>
                  <span className="font-mono text-sm font-medium text-ink" data-numeric>
                    {percent}%
                  </span>
                </div>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-elevated"
                  role="progressbar"
                  aria-valuenow={percent}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Profile completion"
                >
                  <div
                    className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out-expo"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-2 text-xs text-ink-muted">
                  Adding your phone and department helps colleagues reach you.
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-5">
              <div className="flex items-start gap-2.5">
                <ShieldCheck className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                <div>
                  <p className="text-sm font-medium text-ink">Managed by an admin</p>
                  <p className="mt-1 text-xs text-ink-muted">
                    Your role, reporting line, employment status and email address can only be
                    changed by a super admin. Every change is recorded in the audit log.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
        <Card>
          <CardHeader>
            <CardTitle>Your details</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="max-w-md space-y-4">
              <FormError error={updateEmployee.error} />

              <FormField label="Full name" error={form.formState.errors.name} required>
                {(field) => <Input {...field} {...form.register('name')} />}
              </FormField>

              <FormField
                label="Phone"
                error={form.formState.errors.phone}
                hint="Digits, spaces, and + - ( ) only."
              >
                {(field) => <Input {...field} {...form.register('phone')} placeholder="+91 98765 43210" />}
              </FormField>

              <FormField label="Department" error={form.formState.errors.department}>
                {(field) => (
                  <Input {...field} {...form.register('department')} placeholder="e.g. Marketing" />
                )}
              </FormField>

              <div className="flex items-center gap-3 pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  loading={form.formState.isSubmitting}
                  disabled={!form.formState.isDirty && !saved}
                >
                  Save changes
                </Button>
                {saved && (
                  <span className="flex items-center gap-1.5 text-sm text-success" role="status">
                    <Check className="size-3.5" aria-hidden />
                    Saved
                  </span>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <ChangePasswordCard />
        </div>
      </div>
    </>
  )
}
