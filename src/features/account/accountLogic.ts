import type { ProfileInput, ChangePasswordInput } from '../../domain/schemas'

export interface AccountAuthClient {
  auth: {
    signInWithPassword: (input: { email: string; password: string }) => Promise<{ error: { message?: string } | null }>
    updateUser: (input: { password: string }) => Promise<{ error: { message?: string } | null }>
    signOut: (options: { scope: 'others' }) => Promise<{ error: { message?: string } | null }>
  }
}

export async function reauthenticateAndChangePassword(
  client: AccountAuthClient,
  email: string,
  input: ChangePasswordInput,
): Promise<string | null> {
  const reauth = await client.auth.signInWithPassword({ email, password: input.currentPassword })
  if (reauth.error) return 'AUTH_INVALID_CREDENTIALS'
  const updated = await client.auth.updateUser({ password: input.password })
  if (updated.error) return updated.error.message || 'PAGE_500'
  const signedOut = await client.auth.signOut({ scope: 'others' })
  return signedOut.error?.message || null
}

export function profileUpdatePayload(input: ProfileInput): ProfileInput {
  return { name: input.name.trim(), phone: input.phone }
}
