/**
 * Provisions the five fixed accounts the live integration suites sign into.
 *
 * Signup is restricted to company email domains, so these cannot be created
 * through the public API. They are provisioned by `public.provision_account`,
 * which requires a direct database session and deliberately bypasses the
 * allowlist. This script prints the SQL to run; it does not hold credentials.
 *
 *   node scripts/setup-rls-fixtures.mjs
 */
import fs from 'node:fs'

const env = Object.fromEntries(
  fs
    .readFileSync('.env.local', 'utf8')
    .split('\n')
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()]
    }),
)

const password = env.RLS_FIXTURE_PASSWORD

if (!password) {
  console.error(
    'RLS_FIXTURE_PASSWORD is not set in .env.local.\n\n' +
      'Pick something long and random, then add it:\n' +
      '  RLS_FIXTURE_PASSWORD=<your value>\n\n' +
      'It is never committed — .env.local is gitignored.',
  )
  process.exit(1)
}

const FIXTURES = [
  ['rls-fixture-manager@example.com', 'Fixture Manager'],
  ['rls-fixture-report@example.com', 'Fixture Report'],
  ['rls-fixture-outsider@example.com', 'Fixture Outsider'],
  ['rls-fixture-a@example.com', 'Fixture A'],
  ['rls-fixture-b@example.com', 'Fixture B'],
]

const provision = FIXTURES.map(
  ([email, name]) => `select public.provision_account('${email}', '${password}', '${name}');`,
).join('\n')

const link = `
-- Reporting line the manager-scoping suite asserts against.
update public.profiles set role = 'manager'
where email = 'rls-fixture-manager@example.com';

update public.profiles
set manager_id = (select id from public.profiles where email = 'rls-fixture-manager@example.com')
where email = 'rls-fixture-report@example.com';
`.trim()

console.log('Run each of these with:  npx supabase db query --linked "<sql>"\n')
console.log('--- 1. provision ---')
console.log(provision)
console.log('\n--- 2. link the reporting line ---')
console.log(link)
console.log(
  '\nNote: the UPDATE that sets manager_id must run as its own statement with an explicit\n' +
    'value, or the subquery resolves to NULL under RLS and silently writes nothing.',
)
