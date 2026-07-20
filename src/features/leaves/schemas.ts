import { z } from 'zod'

export const leaveRequestSchema = z
  .object({
    leave_type: z.enum([
      'casual',
      'sick',
      'earned',
      'unpaid',
      'comp_off',
      'maternity',
      'paternity',
    ]),
    reason: z
      .string()
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(3, 'Give at least a short reason')
          .max(2000, 'That reason is too long'),
      ),
    start_date: z.string().min(1, 'Pick a start date'),
    end_date: z.string().min(1, 'Pick an end date'),
    // Object key in the private attachments bucket — a medical note, say.
    attachment: z.string().nullable(),
  })
  .refine((data) => data.end_date >= data.start_date, {
    message: 'The end date cannot be before the start date',
    path: ['end_date'],
  })

export type LeaveRequestInput = z.input<typeof leaveRequestSchema>

export const leaveDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decision_note: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(2000, 'That note is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),
})

export type LeaveDecisionInput = z.input<typeof leaveDecisionSchema>
