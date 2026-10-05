import { describe, expect, it } from 'vitest'
import { isAddressSelected, shouldShowNewAddressForm } from './checkoutLogic'

describe('checkout address selection', () => {
  it('opens the address form when there are no saved addresses', () => {
    expect(shouldShowNewAddressForm(0, false)).toBe(true)
  })

  it('keeps the form collapsed when saved addresses exist until requested', () => {
    expect(shouldShowNewAddressForm(2, false)).toBe(false)
    expect(shouldShowNewAddressForm(2, true)).toBe(true)
  })

  it('matches only the selected address card', () => {
    expect(isAddressSelected('address-1', 'address-1')).toBe(true)
    expect(isAddressSelected('address-1', 'address-2')).toBe(false)
  })
})
