import { z } from 'zod'

/**
 * Env is validated at module load, not at first use. A missing Supabase URL
 * should fail loudly on boot with a fixable message rather than surfacing as an
 * opaque network error three screens into the app.
 */

/**
 * This value is compiled into the browser bundle and served to every user, so a
 * privileged key here is a full data breach: service_role and sb_secret_ keys
 * bypass Row Level Security entirely, exposing every employee's attendance,
 * salary-adjacent and CRM data to anyone who opens devtools.
 *
 * Supabase's dashboard lists the publishable and secret keys adjacent to each
 * other under Settings -> API Keys, which makes copying the wrong row easy. We
 * reject it at boot instead of shipping it.
 */
function assertNotPrivileged(key: string): true | string {
  if (key.startsWith('sb_secret_')) {
    return 'This is a SECRET key. Use the publishable key (sb_publishable_...) instead — secret keys bypass RLS and must never reach the browser.'
  }

  // Legacy keys are JWTs carrying the role in their payload. Decode rather than
  // pattern-match, so a service_role key cannot slip through on formatting.
  if (key.startsWith('eyJ')) {
    const payload = key.split('.')[1]
    if (payload) {
      try {
        const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
          role?: unknown
        }
        if (claims.role === 'service_role') {
          return 'This is the SERVICE_ROLE key. Use the anon / public key instead — service_role bypasses RLS and must never reach the browser.'
        }
      } catch {
        // Not decodable as a JWT payload. Shape checks below still apply.
      }
    }
  }

  return true
}

const anonKeySchema = z
  .string()
  .min(20, 'VITE_SUPABASE_ANON_KEY looks empty or truncated')
  .refine(
    (key) => key.startsWith('sb_publishable_') || key.startsWith('eyJ'),
    'VITE_SUPABASE_ANON_KEY should start with "sb_publishable_" (current) or "eyJ" (legacy anon). Copy it from Settings -> API Keys.',
  )
  .superRefine((key, ctx) => {
    const result = assertNotPrivileged(key)
    if (result !== true) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result })
  })

const envSchema = z.object({
  VITE_SUPABASE_URL: z
    .string()
    .url('VITE_SUPABASE_URL must be a valid URL')
    .refine(
      (url) => url.startsWith('https://') || url.startsWith('http://localhost'),
      'VITE_SUPABASE_URL must use https (or http://localhost for a local stack)',
    ),
  VITE_SUPABASE_ANON_KEY: anonKeySchema,
})

const parsed = envSchema.safeParse({
  VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  VITE_SUPABASE_ANON_KEY: import.meta.env.VITE_SUPABASE_ANON_KEY,
})

if (!parsed.success) {
  const issues = parsed.error.issues.map((issue) => `  - ${issue.message}`).join('\n')
  throw new Error(
    `Missing or invalid environment configuration:\n${issues}\n\n` +
      `Copy .env.example to .env.local and fill in your Supabase project values.`,
  )
}

export const env = parsed.data
