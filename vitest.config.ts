import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // The RLS suite hits the live project and creates real rows. It runs under
    // its own config via `npm run test:rls`, never as part of `npm test`.
    exclude: ['**/node_modules/**', '**/dist/**', 'src/test/*.integration.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      // The 80% target applies to business logic, not to presentational shells.
      include: ['src/features/**/*.ts', 'src/lib/**/*.ts'],
      exclude: ['**/*.test.ts', 'src/lib/database.types.ts'],
      thresholds: { lines: 80, functions: 80, branches: 75, statements: 80 },
    },
  },
})
