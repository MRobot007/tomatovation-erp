/**
 * Shared HTTP plumbing for the Edge Functions.
 *
 * Lives here rather than being copied per function because the CORS rule below
 * was arrived at the hard way, and a second copy is a second thing to remember
 * to fix.
 */

/**
 * Allowed headers are REFLECTED from the preflight, not hardcoded.
 *
 * A hardcoded list has to predict every header the client will send, and it
 * silently failed the moment the app's Supabase client was configured with a
 * custom `x-application-name`. The browser asks permission for it, the function
 * refuses, and the request is blocked — surfacing only as "Failed to fetch",
 * with no CORS message and nothing useful in the network tab.
 *
 * Reflecting cannot drift out of step with the client. It is not a widening:
 * a request header is only useful to an attacker if the function reads it, and
 * these functions read exactly one — Authorization — which is verified against
 * the database on every call.
 */
export function corsHeaders(req: Request): Record<string, string> {
  const requested = req.headers.get('Access-Control-Request-Headers')

  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers':
      requested ?? 'authorization, x-client-info, apikey, content-type, x-application-name',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  }
}

export function json(body: unknown, status = 200, req?: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...(req ? corsHeaders(req) : {}),
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    },
  })
}

/**
 * Crypto-random, not Math.random. This is a real credential that grants access
 * to employee records until it is changed.
 *
 * The alphabet omits characters that are easy to confuse when a password is
 * read aloud or copied off a screen: 0/O, 1/l/I.
 */
export function temporaryPassword(length = 16): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('')
}
