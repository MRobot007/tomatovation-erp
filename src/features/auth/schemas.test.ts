import { describe, expect, test } from 'vitest'
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from './schemas'

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

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'oldpassword1',
    newPassword: 'newpassword1',
    confirmPassword: 'newpassword1',
  }

  test('accepts a valid change', () => {
    expect(changePasswordSchema.safeParse(valid).success).toBe(true)
  })

  test('requires the current password', () => {
    const result = changePasswordSchema.safeParse({ ...valid, currentPassword: '' })
    expect(result.success).toBe(false)
  })

  test('rejects a new password under 8 characters', () => {
    const result = changePasswordSchema.safeParse({
      ...valid,
      newPassword: 'short12',
      confirmPassword: 'short12',
    })
    expect(result.success).toBe(false)
  })

  test('rejects a mismatched confirmation, pointing at the confirm field', () => {
    const result = changePasswordSchema.safeParse({ ...valid, confirmPassword: 'different1' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'confirmPassword')).toBe(true)
    }
  })

  test('rejects reusing the current password', () => {
    // Otherwise "change your password" can be satisfied by changing nothing,
    // which defeats the point when the change was prompted by a compromise.
    const result = changePasswordSchema.safeParse({
      currentPassword: 'samepassword1',
      newPassword: 'samepassword1',
      confirmPassword: 'samepassword1',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues.some((i) => i.path[0] === 'newPassword')).toBe(true)
    }
  })

  test('rejects a new password over the bcrypt 72-character ceiling', () => {
    const long = 'a'.repeat(73)
    const result = changePasswordSchema.safeParse({
      currentPassword: 'oldpassword1',
      newPassword: long,
      confirmPassword: long,
    })
    expect(result.success).toBe(false)
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
