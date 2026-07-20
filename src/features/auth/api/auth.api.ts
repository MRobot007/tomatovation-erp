import { supabase } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'
import type { LoginInput, SignupInput } from '../schemas'

export type Profile = Database['public']['Tables']['profiles']['Row']

/**
 * Supabase surfaces auth failures with terse, sometimes misleading text
 * ("Invalid login credentials" covers both a wrong password and an unconfirmed
 * email). Staff cannot act on that, and it generates support tickets, so we
 * translate the cases that have a different remedy.
 */
function translateAuthError(message: string): string {
  const normalised = message.toLowerCase()

  if (normalised.includes('invalid login credentials')) {
    return 'That email and password combination did not match. If you have never signed in, check your inbox for a confirmation link first.'
  }
  if (normalised.includes('email not confirmed')) {
    return 'Your email is not confirmed yet. Check your inbox for the confirmation link.'
  }
  if (normalised.includes('user already registered')) {
    return 'An account already exists for that email. Try signing in, or reset your password.'
  }
  if (normalised.includes('rate limit') || normalised.includes('too many requests')) {
    return 'Too many attempts. Wait a minute before trying again.'
  }
  if (normalised.includes('password should be')) {
    return 'That password is too weak. Use at least 8 characters.'
  }

  // GoTrue reports any exception raised by a trigger on auth.users as a generic
  // 500 "Database error saving new user" — the trigger's own message never
  // reaches the client. The only trigger that rejects a signup is the domain
  // allowlist, so this is the actionable translation.
  if (normalised.includes('database error saving new user')) {
    return 'Sign-up is restricted to approved company email addresses. Use your work email, or ask a super admin to add your domain.'
  }

  return message
}

export class AuthError extends Error {
  constructor(message: string) {
    super(translateAuthError(message))
    this.name = 'AuthError'
  }
}

export async function signIn({ email, password }: Pick<LoginInput, 'email' | 'password'>) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new AuthError(error.message)
  return data
}

export async function signUp({ name, email, password }: Omit<SignupInput, 'confirmPassword'>) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Only `name` is read by the handle_new_user trigger. Role is never taken
      // from here — this payload is fully client-controlled.
      data: { name },
      emailRedirectTo: `${window.location.origin}/login`,
    },
  })
  if (error) throw new AuthError(error.message)
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw new AuthError(error.message)
}

export async function requestPasswordReset(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  if (error) throw new AuthError(error.message)
}

export async function updatePassword(password: string) {
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw new AuthError(error.message)
}

/**
 * Returns null rather than throwing when the row is missing. That gap is a real
 * state — the auth user exists but handle_new_user has not committed yet — and
 * the provider handles it by retrying rather than dumping the user at an error
 * screen mid-signup.
 */
export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function updateOwnProfile(
  userId: string,
  patch: Pick<Database['public']['Tables']['profiles']['Update'], 'name' | 'phone' | 'department' | 'profile_photo'>,
): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}
