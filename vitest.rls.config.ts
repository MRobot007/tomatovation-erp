import { defineConfig, loadEnv } from 'vite'
import path from 'node:path'

/**
 * Separate config for the live RLS integration suite. Kept out of the default
 * vitest run so `npm test` stays hermetic — these tests hit the real project
 * and create real rows.
 *
 * Runs in node (not jsdom) and serially: the assertions share two accounts and
 * depend on ordering within each describe block.
 */
export default defineConfig(({ mode }) => {
  // Both prefixes: VITE_ for the Supabase connection, RLS_ for the fixture
  // password. loadEnv filters by prefix, so 'VITE_' alone silently drops
  // RLS_FIXTURE_PASSWORD and every suite fails at sign-in.
  const env = loadEnv(mode, process.cwd(), ['VITE_', 'RLS_'])

  return {
    resolve: { alias: { '@': path.resolve(__dirname, './src') } },
    test: {
      globals: true,
      environment: 'node',
      include: ['src/test/*.integration.test.ts'],
      testTimeout: 30_000,
      hookTimeout: 45_000,
      fileParallelism: false,
      sequence: { concurrent: false },
      env,
    },
  }
})
