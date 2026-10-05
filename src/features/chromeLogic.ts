import type { businessConfig } from '../config/businessConfig'

type Contact = { [Key in keyof typeof businessConfig.contact]: string }
export function getFilledContactEntries(contact: Contact): Array<[keyof Contact, string]> {
  return (Object.entries(contact) as Array<[keyof Contact, string]>).filter(([, value]) => value.trim().length > 0)
}
