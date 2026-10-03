export function isExistingEmailResponse(user: { identities?: unknown[] } | null): boolean {
  return Boolean(user && Array.isArray(user.identities) && user.identities.length === 0)
}
