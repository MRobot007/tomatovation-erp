import { describe, expect, test } from 'vitest'
import { forgotPasswordSchema, loginSchema, resetPasswordSchema, signupSchema } from './schemas'

describe('loginSchema', () => {
  test('accepts a valid credential pair', () => {
    const result = loginSchema.safeParse({ email: 'a@b.com', password: 'secret', remember: true })
    expect(result.success).toBe(true)
  })

  test('normalises email casing and surrounding whitespace', () => {
    const result = loginSchema.parse({ email: '  Ronak@Tomatovation.COM ', password: 'x' })
    expect(result.email).toBe('ronak@tomatovation.com')
  })

  test('defaults remember to true when omitted', () => {
    const result = loginSchema.parse({ email: 'a@b.com', password: 'x' })
    expect(result.remember).toBe(true)
  })

  test('rejects a malformed email', () => {
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'x' })
    expect(result.success).toBe(false)
  })

  test('rejects an empty password without imposing a length rule', () => {
    // Sign-in must not leak the password policy, and legacy accounts may
    // predate the current minimum.
    expect(loginSchema.safeParse({ email: 'a@b.com', password: '' }).success).toBe(false)
    expect(loginSchema.safeParse({ email: 'a@b.com', password: 'short' }).success).toBe(true)
  })
})

describe('signupSchema', () => {
  const valid = {
    name: 'Priya Sharma',
    email: 'priya@tomatovation.com',
    password: 'longenough',
    confirmPassword: 'longenough',
  }

  test('accepts a complete valid signup', () => {
    expect(signupSchema.safeParse(valid).success).toBe(true)
  })

  test('trims the name', () => {
    expect(signupSchema.parse({ ...valid, name: '  Priya Sharma  ' }).name).toBe('Priya Sharma')
  })

  test('rejects a password under 8 characters', () => {
    const result = signupSchema.safeParse({ ...valid, password: 'short12', confirmPassword: 'short12' })
    expect(result.success).toBe(false)
  })

  test('rejects mismatched passwords and points at the confirm field', () => {
    const result = signupSchema.safeParse({ ...valid, confirmPassword: 'different1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['confirmPassword'])
    }
  })

  test('rejects a password over the bcrypt 72-character ceiling', () => {
    const long = 'a'.repeat(73)
    const result = signupSchema.safeParse({ ...valid, password: long, confirmPassword: long })
    expect(result.success).toBe(false)
  })

  test('rejects an empty name', () => {
    expect(signupSchema.safeParse({ ...valid, name: '   ' }).success).toBe(false)
  })
})

describe('resetPasswordSchema', () => {
  test('accepts a matching pair of valid passwords', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'longenough' })
        .success,
    ).toBe(true)
  })

  test('rejects a mismatch', () => {
    expect(
      resetPasswordSchema.safeParse({ password: 'longenough', confirmPassword: 'other12345' })
        .success,
    ).toBe(false)
  })
})

describe('forgotPasswordSchema', () => {
  test('normalises the email', () => {
    expect(forgotPasswordSchema.parse({ email: ' A@B.COM ' }).email).toBe('a@b.com')
  })

  test('rejects an empty email', () => {
    expect(forgotPasswordSchema.safeParse({ email: '' }).success).toBe(false)
  })
})
