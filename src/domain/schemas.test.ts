import { describe, expect, it } from 'vitest'
import { loginSchema, normalizeEgyptianPhone, registerSchema, resetPasswordSchema } from './schemas'
import { isExistingEmailResponse } from './auth'

const valid = { name: 'Amr Marei', email: 'Amr@example.com', phone: '010 1234-5678', password: 'password1', confirmPassword: 'password1' }

describe('authentication schemas (BR 1.1)', () => {
  it('accepts valid registration and normalizes email and phone', () => {
    const result = registerSchema.safeParse(valid)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data).toMatchObject({ email: 'amr@example.com', phone: '01012345678' })
  })
  it('enforces name length', () => {
    expect(registerSchema.safeParse({ ...valid, name: 'A' }).success).toBe(false)
    expect(registerSchema.safeParse({ ...valid, name: 'A'.repeat(61) }).success).toBe(false)
  })
  it('rejects invalid email and Egyptian phone', () => {
    expect(registerSchema.safeParse({ ...valid, email: 'not-email' }).success).toBe(false)
    for (const phone of ['02012345678', '0101234567', '010123456789']) {
      expect(registerSchema.safeParse({ ...valid, phone }).success).toBe(false)
    }
    expect(normalizeEgyptianPhone('+20 1012345678')).toBe('01012345678')
  })
  it('requires a password with eight characters, a letter, and a digit', () => {
    for (const password of ['short1', 'password', '12345678']) {
      expect(registerSchema.safeParse({ ...valid, password, confirmPassword: password }).success).toBe(false)
    }
    expect(loginSchema.safeParse({ email: valid.email, password: '' }).success).toBe(false)
  })
  it('requires matching confirmation', () => {
    expect(registerSchema.safeParse({ ...valid, confirmPassword: 'different1' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ password: 'password1', confirmPassword: 'different1' }).success).toBe(false)
  })
  it('validates login and forgot-password email', () => {
    expect(loginSchema.safeParse({ email: valid.email, password: valid.password }).success).toBe(true)
  })
  it('detects Supabase email-confirmation mode empty identities', () => {
    expect(isExistingEmailResponse({ identities: [] })).toBe(true)
    expect(isExistingEmailResponse({ identities: [{ id: 'new' }] })).toBe(false)
    expect(isExistingEmailResponse(null)).toBe(false)
  })
})
