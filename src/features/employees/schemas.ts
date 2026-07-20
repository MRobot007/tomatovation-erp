import { z } from 'zod'
import { ROLES } from '@/lib/roles'

/**
 * Mirrors the CHECK constraints on public.profiles. Where the database and this
 * file disagree the database wins — this exists to give a fast, field-level
 * message, not to be the boundary.
 */
export const employeeFormSchema = z.object({
  name: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, 'Name is required').max(120, 'Name is too long')),

  role: z.enum(ROLES, { required_error: 'Pick a role' }),

  department: z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(80, 'Department name is too long'))
    .transform((value) => (value === '' ? null : value))
    .nullable(),

  // 'none' rather than '' — Radix Select treats an empty string value as
  // "no selection" and refuses to render the item.
  manager_id: z
    .string()
    .transform((value) => (value === 'none' || value === '' ? null : value))
    .nullable(),

  phone: z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .regex(/^$|^[0-9+\-\s()]{6,20}$/, 'Use digits, spaces, and + - ( ) only'),
    )
    .transform((value) => (value === '' ? null : value))
    .nullable(),

  status: z.enum(['active', 'inactive', 'suspended'], { required_error: 'Pick a status' }),
})

export type EmployeeFormInput = z.input<typeof employeeFormSchema>
export type EmployeeFormOutput = z.output<typeof employeeFormSchema>

/** Fields an employee may edit on their own profile. */
export const ownProfileSchema = employeeFormSchema.pick({
  name: true,
  phone: true,
  department: true,
})

export type OwnProfileInput = z.input<typeof ownProfileSchema>
