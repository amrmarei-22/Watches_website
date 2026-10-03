import { describe, expect, it, vi } from 'vitest'
import { changePasswordSchema, profileSchema } from '../../domain/schemas'
import { reauthenticateAndChangePassword } from './accountLogic'

describe('account schemas', () => {
  it('validates and normalizes a profile', () => {
    expect(profileSchema.parse({ name: '  Samir  ', phone: '+20 1012345678' })).toEqual({ name: 'Samir', phone: '01012345678' })
  })

  it('requires a strong matching new password', () => {
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', password: 'weak', confirmPassword: 'weak' }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'old', password: 'newpass1', confirmPassword: 'newpass1' }).success).toBe(true)
  })
})

describe('reauthenticateAndChangePassword', () => {
  it('stops on invalid current credentials', async () => {
    const client = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: { message: 'Invalid login credentials' } }), updateUser: vi.fn(), signOut: vi.fn() } }
    await expect(reauthenticateAndChangePassword(client, 'a@example.com', { currentPassword: 'wrong', password: 'newpass1', confirmPassword: 'newpass1' })).resolves.toBe('AUTH_INVALID_CREDENTIALS')
    expect(client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('updates the password and signs out other sessions', async () => {
    const client = { auth: { signInWithPassword: vi.fn().mockResolvedValue({ error: null }), updateUser: vi.fn().mockResolvedValue({ error: null }), signOut: vi.fn().mockResolvedValue({ error: null }) } }
    await expect(reauthenticateAndChangePassword(client, 'a@example.com', { currentPassword: 'oldpass1', password: 'newpass1', confirmPassword: 'newpass1' })).resolves.toBeNull()
    expect(client.auth.signInWithPassword).toHaveBeenCalledWith({ email: 'a@example.com', password: 'oldpass1' })
    expect(client.auth.signOut).toHaveBeenCalledWith({ scope: 'others' })
  })
})
