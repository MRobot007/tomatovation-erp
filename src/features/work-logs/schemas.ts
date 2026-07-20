import { z } from 'zod'

const trimmed = (max: number, label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label} is required`).max(max, `${label} is too long`))

const optionalText = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max, 'That is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable()

/** Mirrors the CHECK constraints on public.work_logs. */
export const workLogSchema = z.object({
  log_date: z.string().min(1, 'Pick a date'),
  project: trimmed(120, 'Project'),
  task: trimmed(200, 'Task'),
  description: optionalText(4000),
  hours: z.coerce
    .number({ invalid_type_error: 'Hours must be a number' })
    .positive('Hours must be greater than zero')
    .max(24, 'A day cannot exceed 24 hours'),
  status: z.enum(['draft', 'submitted']),
  achievement: optionalText(2000),
  tomorrow_plan: optionalText(2000),
  // Storage object key, not a URL — the attachments bucket is private, so a URL
  // would expire. Signed links are minted on demand at view time.
  attachment: z.string().nullable(),
})

export type WorkLogFormInput = z.input<typeof workLogSchema>

export const reviewSchema = z.object({
  verdict: z.enum(['reviewed', 'needs_changes']),
  comment: optionalText(2000),
})

export type ReviewInput = z.input<typeof reviewSchema>
