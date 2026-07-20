import { z } from 'zod'

export const taskSchema = z.object({
  title: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Title is required').max(200, 'Title is too long')),

  description: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(4000, 'Description is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),

  assigned_to: z.string().uuid('Pick someone to assign this to'),

  priority: z.enum(['low', 'medium', 'high', 'urgent']),

  // datetime-local produces 'YYYY-MM-DDTHH:mm' with no zone; treated as local
  // and converted to an instant here so the database stores a real timestamptz.
  deadline: z
    .string()
    .transform((value) => (value.trim() === '' ? null : new Date(value).toISOString()))
    .nullable(),

  status: z.enum(['todo', 'in_progress', 'blocked', 'done', 'cancelled']),
})

export type TaskFormInput = z.input<typeof taskSchema>
