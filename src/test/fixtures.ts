/**
 * Shared configuration for the live integration suites.
 *
 * The fixture password is read from the environment and has NO fallback value.
 * It used to be a literal in five test files, which is fine until the
 * repository is public — at which point the password, plus the project URL that
 * ships in every client bundle anyway, is enough for a stranger to sign in as a
 * fixture account and read the employee directory and the whole pipeline.
 *
 * Set it in .env.local (gitignored):
 *
 *   RLS_FIXTURE_PASSWORD=<something long and random>
 *
 * and provision the accounts with that same value. See the README.
 */

export const FIXTURE_EMAILS = {
  /** role = 'manager', manages `report` */
  manager: 'rls-fixture-manager@example.com',
  /** manager_id = manager.id — inside the reporting boundary */
  report: 'rls-fixture-report@example.com',
  /** no relationship to anyone — outside the boundary */
  outsider: 'rls-fixture-outsider@example.com',
  /** plain employee, unrelated to `b` */
  a: 'rls-fixture-a@example.com',
  /** plain employee, unrelated to `a`; also used by the attendance suite */
  b: 'rls-fixture-b@example.com',
} as const

export function fixturePassword(): string {
  const password = process.env.RLS_FIXTURE_PASSWORD

  if (!password) {
    throw new Error(
      'RLS_FIXTURE_PASSWORD is not set.\n\n' +
        'The live integration suites sign into pre-provisioned accounts. Add to .env.local:\n' +
        '  RLS_FIXTURE_PASSWORD=<the password the fixtures were provisioned with>\n\n' +
        'See README → "Running the live suites".',
    )
  }

  return password
}

export function supabaseConfig(): { url: string; key: string } {
  const url = process.env.VITE_SUPABASE_URL
  const key = process.env.VITE_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY not set in .env.local')
  }

  return { url, key }
}
