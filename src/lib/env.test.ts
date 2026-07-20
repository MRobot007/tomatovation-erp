import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest'

/**
 * env.ts validates at module load, so each case needs a fresh module registry
 * with import.meta.env stubbed before the import is evaluated.
 */
async function loadEnv(url: unknown, key: unknown) {
  vi.resetModules()
  vi.stubEnv('VITE_SUPABASE_URL', url as string)
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key as string)
  return import('./env')
}

/** Builds a legacy-format JWT carrying the given role claim. */
function legacyKey(role: string): string {
  const encode = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${encode({ role, iss: 'supabase' })}.signature`
}

const VALID_URL = 'https://example-project-ref.supabase.co'
const VALID_PUBLISHABLE = 'sb_publishable_EXAMPLE_NOT_A_REAL_KEY_000000'

beforeEach(() => vi.resetModules())
afterEach(() => vi.unstubAllEnvs())

describe('accepts valid configuration', () => {
  test('accepts a current publishable key', async () => {
    const { env } = await loadEnv(VALID_URL, VALID_PUBLISHABLE)
    expect(env.VITE_SUPABASE_ANON_KEY).toBe(VALID_PUBLISHABLE)
  })

  test('accepts a legacy anon JWT', async () => {
    const key = legacyKey('anon')
    const { env } = await loadEnv(VALID_URL, key)
    expect(env.VITE_SUPABASE_ANON_KEY).toBe(key)
  })

  test('accepts a local Supabase stack over http', async () => {
    const { env } = await loadEnv('http://localhost:54321', VALID_PUBLISHABLE)
    expect(env.VITE_SUPABASE_URL).toBe('http://localhost:54321')
  })
})

describe('rejects privileged keys that would leak through the browser bundle', () => {
  test('rejects a secret key by prefix', async () => {
    await expect(loadEnv(VALID_URL, 'sb_secret_EXAMPLE_NOT_A_REAL_KEY_0000')).rejects.toThrow(
      /SECRET key/i,
    )
  })

  test('rejects a legacy service_role JWT by decoding its role claim', async () => {
    await expect(loadEnv(VALID_URL, legacyKey('service_role'))).rejects.toThrow(/SERVICE_ROLE/i)
  })
})

describe('rejects malformed configuration', () => {
  test('rejects a missing key', async () => {
    await expect(loadEnv(VALID_URL, '')).rejects.toThrow(/empty or truncated/i)
  })

  test('rejects a key with an unrecognised prefix', async () => {
    await expect(loadEnv(VALID_URL, 'totally-not-a-supabase-key-but-long-enough')).rejects.toThrow(
      /should start with/i,
    )
  })

  test('rejects a non-URL project url', async () => {
    await expect(loadEnv('not-a-url', VALID_PUBLISHABLE)).rejects.toThrow(/valid URL/i)
  })

  test('rejects a non-localhost http url', async () => {
    await expect(loadEnv('http://example-project-ref.supabase.co', VALID_PUBLISHABLE)).rejects.toThrow(
      /must use https/i,
    )
  })
})
