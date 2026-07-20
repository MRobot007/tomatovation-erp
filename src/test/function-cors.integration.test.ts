import { describe, expect, test } from 'vitest'
import { supabaseConfig } from './fixtures'

/**
 * Edge Function CORS — run against the LIVE linked project.
 *
 *   npm run test:cors
 *
 * A browser sends an OPTIONS preflight before any cross-origin POST, and that
 * preflight carries NO Authorization header. Deploying the function with the
 * gateway's JWT verification enabled makes Supabase reject that preflight with
 * 401 before the function runs, and the browser reports it only as
 * "Failed to fetch" — with no CORS message and nothing in the network tab.
 *
 * Server-to-server calls send no preflight, so every curl and every test that
 * used a token passed while the browser was completely broken. That is exactly
 * how this shipped. These tests exercise the preflight specifically.
 */

const { url, key } = supabaseConfig()
const ENDPOINT = `${url}/functions/v1/create-employee`
const ORIGIN = 'https://tomatovation-erp.vercel.app'

describe('preflight', () => {
  test('OPTIONS succeeds without an Authorization header', async () => {
    const response = await fetch(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, content-type, apikey',
      },
    })

    expect(response.status).toBe(200)
  })

  /**
   * The exact header set supabase-js sends from this app.
   *
   * `x-application-name` is ours, configured on the client in lib/supabase.ts.
   * An earlier version of this test asserted only the three standard headers —
   * the ones I assumed — so it passed while the browser was blocked, because
   * the function's hardcoded allow-list did not include our own custom header.
   * Testing assumed headers instead of real ones is how that shipped twice.
   */
  const CLIENT_HEADERS = [
    'authorization',
    'content-type',
    'apikey',
    'x-client-info',
    'x-application-name',
  ]

  test('the preflight allows every header this app actually sends', async () => {
    const response = await fetch(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': CLIENT_HEADERS.join(', '),
      },
    })

    expect(response.status).toBe(200)

    const allowed = (response.headers.get('access-control-allow-headers') ?? '').toLowerCase()
    for (const header of CLIENT_HEADERS) {
      expect(allowed, `preflight must allow "${header}"`).toContain(header)
    }
  })

  test('an unexpected custom header is still reflected, so the client cannot drift out of step', async () => {
    const response = await fetch(ENDPOINT, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'authorization, x-some-future-header',
      },
    })

    const allowed = (response.headers.get('access-control-allow-headers') ?? '').toLowerCase()
    expect(allowed).toContain('x-some-future-header')
  })
})

describe('the function still authorises for itself', () => {
  test('an unauthenticated POST is rejected by the function, not the gateway', async () => {
    // With gateway verification off, this 401 must come from our own check.
    // If it ever stops being 401, the function is open.
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: key },
      body: JSON.stringify({ name: 'Anon', email: 'anon@example.com', role: 'super_admin' }),
    })

    expect(response.status).toBe(401)
    const body = (await response.json()) as { error?: string }
    expect(body.error).toMatch(/not authenticated/i)
  })
})
