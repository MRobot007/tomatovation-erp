import { supabase } from './supabase'

/**
 * Pulls the real message out of a Functions error.
 *
 * supabase-js reports every non-2xx as "Edge Function returned a non-2xx status
 * code" and puts the useful text in the response body. The shape of `context`
 * is not guaranteed across versions — an earlier version of this code assumed
 * it was always a Response and called `.clone()` on it, which threw
 * "d.clone is not a function" and replaced every real error with that. An error
 * handler that can itself throw is worse than no handler, because it hides the
 * failure it was written to explain.
 *
 * So each shape is probed defensively, and the generic message is the floor.
 */
export async function extractMessage(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : 'The request failed'
  const context = (error as { context?: unknown }).context

  if (!context) return fallback

  // A Response, in whichever form this version hands it over.
  if (typeof (context as Response).json === 'function') {
    try {
      const body = (await (context as Response).json()) as { error?: string; message?: string }
      return body?.error ?? body?.message ?? fallback
    } catch {
      /* body was empty or not JSON */
    }
  }

  // Already-parsed body.
  if (typeof context === 'object') {
    const body = context as { error?: string; message?: string; body?: unknown }
    if (typeof body.error === 'string') return body.error
    if (typeof body.message === 'string') return body.message

    if (typeof body.body === 'string') {
      try {
        const parsed = JSON.parse(body.body) as { error?: string }
        if (parsed?.error) return parsed.error
      } catch {
        return body.body
      }
    }
  }

  if (typeof context === 'string') return context

  return fallback
}

/**
 * Calls an Edge Function with the caller's session attached, and surfaces the
 * function's own error text rather than a generic one.
 *
 * The token is attached explicitly rather than relying on functions.invoke to
 * do it. It is supposed to inherit the session, but with a custom
 * `global.headers` on the client it sent no Authorization header at all and the
 * function correctly answered 401 "Not authenticated" — which reads like the
 * user is signed out when they plainly are not.
 *
 * Reading the session here also gives a precise error when it has genuinely
 * expired, instead of a bare 401 from the far end.
 */
export async function invokeFunction<T>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token

  if (!token) {
    throw new Error('Your session has expired. Sign in again and retry.')
  }

  const { data, error } = await supabase.functions.invoke<T | { error: string }>(name, {
    body,
    headers: { Authorization: `Bearer ${token}` },
  })

  if (error) throw new Error(await extractMessage(error))

  if (data && typeof data === 'object' && 'error' in data) {
    throw new Error((data as { error: string }).error)
  }
  if (!data) throw new Error('The server returned no response')

  return data as T
}
