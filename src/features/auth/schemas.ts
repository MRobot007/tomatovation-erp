import { z } from 'zod'

/**
 * Client-side validation only. Every one of these rules is also enforced by
 * Supabase Auth or a database constraint — this layer exists to give a fast,
 * specific error next to the field, not to be the boundary.
 */

/**
 * Trim BEFORE validating, via transform().pipe(). Chaining .email() first and
 * .transform() after would validate the raw string, so a pasted address or one
 * completed by a mobile keyboard — both of which routinely carry a trailing
 * space — would be rejected as malformed before the trim ever ran.
 */
const email = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(
    z
      .string()
      .min(1, 'Email is required')
      .email('That does not look like a valid email'),
  )

/**
 * Supabase's default minimum is 6. We ask for 8 because this holds staff
 * records; the extra two characters cost nothing and the app is used daily by
 * people who will pick something memorable regardless.
 */
const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Passwords are limited to 72 characters')

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
  remember: z.boolean().default(true),
})

export const signupSchema = z
  .object({
    // Same ordering trap as email: validating first would accept "   ",
    // which passes min(1) at three characters and only then trims to empty.
    name: z
      .string()
      .transform((value) => value.trim())
      .pipe(z.string().min(1, 'Name is required').max(120, 'That name is too long')),
    email,
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export const forgotPasswordSchema = z.object({ email })

export const resetPasswordSchema = z
  .object({
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SignupInput = z.infer<typeof signupSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>
