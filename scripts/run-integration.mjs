/**
 * Runs the live integration suites, then always cleans up the throwaway
 * accounts they create — pass or fail.
 *
 * This exists instead of chaining npm scripts in the shell. `a; b` is a Unix
 * separator that Windows passes through as part of the previous argument, and
 * `a && b` skips the cleanup on failure, which is exactly when orphaned test
 * accounts are most likely to be left in the roster.
 */
import { spawnSync } from 'node:child_process'

const PROBE_PREFIXES = ['invite-probe-%', 'cors-probe-%', 'pipeline-%', 'mx_-%']

const CLEANUP_SQL = `delete from auth.users where ${PROBE_PREFIXES.map(
  (p) => `email like '${p}'`,
).join(' or ')}`

function run(command, args) {
  return spawnSync(command, args, { stdio: 'inherit', shell: true }).status ?? 1
}

const testStatus = run('npx', ['vitest', 'run', '--config', 'vitest.rls.config.ts'])

console.log('\n— cleaning up probe accounts —')
run('npx', ['supabase', 'db', 'query', '--linked', `"${CLEANUP_SQL}"`])

// Exit with the TEST result, not the cleanup result. A cleanup hiccup must not
// turn a red suite green, and must not fail a green one.
process.exit(testStatus)
