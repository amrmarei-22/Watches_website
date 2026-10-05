import type { businessConfig } from '../config/businessConfig'

type Contact = { [Key in keyof typeof businessConfig.contact]: string }
export function getFilledContactEntries(contact: Contact): Array<[keyof Contact, string]> {
  return (Object.entries(contact) as Array<[keyof Contact, string]>).filter(([, value]) => value.trim().length > 0)
}

export function getCartBadgeCount(count: number): string | null {
  if (count <= 0) return null
  return count > 99 ? '99+' : String(count)
}

export function isFocusPage(pathname: string): boolean {
  return /^\/(?:ar|en)\/(?:checkout(?:\/confirmation\/[^/]+)?|login|register|forgot-password|reset-password|verify-email)(?:\/|$)/.test(pathname)
}
