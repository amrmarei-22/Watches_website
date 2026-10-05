export function shouldShowNewAddressForm(savedAddressCount: number, requestedOpen: boolean): boolean {
  return savedAddressCount === 0 || requestedOpen
}

export function isAddressSelected(selectedId: string | null, addressId: string): boolean {
  return selectedId === addressId
}
