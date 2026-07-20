import { z } from 'zod'

const optional = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max, 'That is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable()

/** Mirrors the CHECK constraints on public.leads. */
export const leadSchema = z.object({
  company: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Company is required').max(160, 'Company name is too long')),

  contact_name: optional(120),

  phone: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().regex(/^$|^[0-9+\-\s()]{6,20}$/, 'Use digits, spaces, and + - ( ) only'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),

  email: z
    .string()
    .transform((value) => value.trim().toLowerCase())
    .pipe(z.string().regex(/^$|^[^@\s]+@[^@\s]+\.[^@\s]+$/, 'That does not look like a valid email'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),

  country: optional(80),
  product_sector: optional(120),
  website: optional(255),
  scope: optional(2000),

  source: z.enum([
    'website',
    'referral',
    'cold_call',
    'email_campaign',
    'social',
    'event',
    'partner',
    'other',
  ]),

  status: z.enum(['new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost']),
  priority: z.enum(['low', 'medium', 'high']),

  // 'none' rather than '', because Radix Select cannot render an empty value.
  assigned_to: z
    .string()
    .transform((value) => (value === 'none' || value === '' ? null : value))
    .nullable(),

  value_estimate: z
    .union([z.string(), z.number()])
    .transform((value) => (value === '' || value == null ? null : Number(value)))
    .refine((value) => value == null || (Number.isFinite(value) && value >= 0), {
      message: 'Enter a positive amount',
    })
    .nullable(),

  next_followup: z
    .string()
    .transform((value) => (value.trim() === '' ? null : value))
    .nullable(),

  remarks: optional(4000),
})

export type LeadFormInput = z.input<typeof leadSchema>

export const activitySchema = z.object({
  activity: z.enum(['note', 'call', 'email', 'meeting']),
  remarks: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Add a note').max(4000, 'That is too long')),
})

export type ActivityInput = z.input<typeof activitySchema>
