import { describe, expect, it } from 'vitest'
import {
  canPlaceManualOrder,
  formatFileSize,
  isAddressSelected,
  shouldShowNewAddressForm,
  validateReceiptFile,
} from './checkoutLogic'

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

describe('receipt validation logic', () => {
  it('accepts valid jpg, png, and webp images within 5MB', () => {
    expect(validateReceiptFile({ name: 'receipt.png', type: 'image/png', size: 1024 * 1024 })).toEqual({ valid: true })
    expect(validateReceiptFile({ name: 'receipt.jpg', type: 'image/jpeg', size: 2 * 1024 * 1024 })).toEqual({ valid: true })
    expect(validateReceiptFile({ name: 'receipt.jpeg', type: 'image/jpeg', size: 500 * 1024 })).toEqual({ valid: true })
    expect(validateReceiptFile({ name: 'receipt.webp', type: 'image/webp', size: 5 * 1024 * 1024 })).toEqual({ valid: true })
  })

  it('rejects unsupported file formats like pdf, gif, or svg', () => {
    expect(validateReceiptFile({ name: 'document.pdf', type: 'application/pdf', size: 500 * 1024 })).toEqual({
      valid: false,
      error: 'RECEIPT_INVALID_TYPE',
    })
    expect(validateReceiptFile({ name: 'receipt.gif', type: 'image/gif', size: 500 * 1024 })).toEqual({
      valid: false,
      error: 'RECEIPT_INVALID_TYPE',
    })
    expect(validateReceiptFile({ name: 'receipt.exe', type: 'application/x-msdownload', size: 500 * 1024 })).toEqual({
      valid: false,
      error: 'RECEIPT_INVALID_TYPE',
    })
  })

  it('rejects files larger than 5MB', () => {
    const tooLarge = 5 * 1024 * 1024 + 1
    expect(validateReceiptFile({ name: 'receipt.png', type: 'image/png', size: tooLarge }, 5)).toEqual({
      valid: false,
      error: 'RECEIPT_MAX_SIZE',
    })
  })

  it('formats file sizes accurately', () => {
    expect(formatFileSize(500)).toBe('500 B')
    expect(formatFileSize(2048)).toBe('2.0 KB')
    expect(formatFileSize(1.5 * 1024 * 1024)).toBe('1.5 MB')
  })

  it('determines if manual order can be placed only when receipt is present and not submitting', () => {
    expect(canPlaceManualOrder(false, false)).toBe(false)
    expect(canPlaceManualOrder(true, true)).toBe(false)
    expect(canPlaceManualOrder(false, true)).toBe(false)
    expect(canPlaceManualOrder(true, false)).toBe(true)
  })
})
