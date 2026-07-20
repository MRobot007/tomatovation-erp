import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Check, Info } from 'lucide-react'
import { PageHeader } from '@/components/page-header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ErrorState } from '@/components/ui/states'
import { FormError, FormField } from '@/components/ui/form-field'
import { useSettings, useUpdateSettings } from '@/features/admin/hooks/use-admin'

/** Mirrors the CHECK constraints on public.app_settings. */
const schema = z.object({
  work_day_start: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  work_day_end: z.string().regex(/^\d{2}:\d{2}$/, 'Use HH:MM'),
  standard_hours: z.coerce.number().positive('Must be more than zero').max(24, 'Cannot exceed 24'),
  late_grace_minutes: z.coerce.number().int().min(0).max(240, 'Cannot exceed 240 minutes'),
  half_day_max_hours: z.coerce.number().positive('Must be more than zero').max(24),
  auto_punch_out_after: z.coerce
    .number()
    .int()
    .min(60, 'At least 60 minutes')
    .max(1440, 'At most 1440 minutes'),
  timezone: z.string().min(1, 'Timezone is required'),
})

type FormInput = z.input<typeof schema>

export function SettingsPage() {
  const { data, isLoading, error, refetch } = useSettings()
  const update = useUpdateSettings()
  const [saved, setSaved] = useState(false)

  const form = useForm<FormInput>({ resolver: zodResolver(schema) })

  useEffect(() => {
    if (!data) return
    form.reset({
      // Postgres returns time as HH:MM:SS; the time input wants HH:MM.
      work_day_start: data.work_day_start.slice(0, 5),
      work_day_end: data.work_day_end.slice(0, 5),
      standard_hours: data.standard_hours,
      late_grace_minutes: data.late_grace_minutes,
      half_day_max_hours: data.half_day_max_hours,
      auto_punch_out_after: data.auto_punch_out_after,
      timezone: data.timezone,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])

  if (error) return <ErrorState error={error} onRetry={refetch} />

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full max-w-2xl" />
      </div>
    )
  }

  const onSubmit = form.handleSubmit(async (values) => {
    setSaved(false)
    await update.mutateAsync(schema.parse(values))
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2500)
  })

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Settings"
        description="These values drive the attendance calculations that run inside the database."
      />

      <form onSubmit={onSubmit} className="max-w-2xl space-y-5">
        <FormError error={update.error} />

        <p className="flex items-start gap-2.5 rounded border border-info/25 bg-info-soft px-3 py-2.5 text-sm text-info">
          <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            Changing these affects <strong>future</strong> calculations only. Attendance already
            recorded keeps the hours and late minutes computed under the previous settings — payroll
            history is not rewritten retroactively.
          </span>
        </p>

        <Card>
          <CardHeader>
            <CardTitle>Working day</CardTitle>
            <CardDescription>
              Late minutes are measured from the start time plus the grace window.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Day starts" error={form.formState.errors.work_day_start} required>
              {(field) => <Input {...field} {...form.register('work_day_start')} type="time" />}
            </FormField>

            <FormField label="Day ends" error={form.formState.errors.work_day_end} required>
              {(field) => <Input {...field} {...form.register('work_day_end')} type="time" />}
            </FormField>

            <FormField
              label="Standard hours"
              error={form.formState.errors.standard_hours}
              hint="Anything worked beyond this counts as overtime."
              required
            >
              {(field) => (
                <Input {...field} {...form.register('standard_hours')} type="number" step="0.25" min="0.25" max="24" />
              )}
            </FormField>

            <FormField
              label="Late grace (minutes)"
              error={form.formState.errors.late_grace_minutes}
              hint="Arriving within this window is not counted late."
              required
            >
              {(field) => (
                <Input {...field} {...form.register('late_grace_minutes')} type="number" min="0" max="240" />
              )}
            </FormField>

            <FormField
              label="Half day up to (hours)"
              error={form.formState.errors.half_day_max_hours}
              required
            >
              {(field) => (
                <Input {...field} {...form.register('half_day_max_hours')} type="number" step="0.25" min="0.25" />
              )}
            </FormField>

            <FormField
              label="Punch-out reminder after (minutes)"
              error={form.formState.errors.auto_punch_out_after}
              hint="Someone still clocked in past this gets a reminder."
              required
            >
              {(field) => (
                <Input {...field} {...form.register('auto_punch_out_after')} type="number" min="60" max="1440" />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Timezone</CardTitle>
            <CardDescription>
              Decides which calendar day a punch belongs to. A punch at 00:30 IST from a laptop set
              to UTC still lands on the correct local day.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              label="IANA timezone"
              error={form.formState.errors.timezone}
              hint="For example Asia/Kolkata, Europe/London, America/New_York."
              required
            >
              {(field) => <Input {...field} {...form.register('timezone')} />}
            </FormField>
          </CardContent>
        </Card>

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            variant="primary"
            loading={form.formState.isSubmitting}
            disabled={!form.formState.isDirty}
          >
            Save settings
          </Button>
          {saved && (
            <span className="flex items-center gap-1.5 text-sm text-success" role="status">
              <Check className="size-3.5" aria-hidden />
              Saved
            </span>
          )}
        </div>
      </form>
    </>
  )
}
