import { describe, expect, it } from 'vitest'
import { getCartBadgeCount, getFilledContactEntries, isFocusPage } from './chromeLogic'

describe('chrome visibility', () => {
  it('hides empty contact values and promises', () => {
    expect(getFilledContactEntries({ whatsapp: '', phone: '010', email: '', hoursEn: '', hoursAr: '', instagram: '', facebook: '' })).toEqual([['phone', '010']])
  })

  it.each([[0, null], [1, '1'], [99, '99'], [100, '99+']])('formats cart badge %s', (count, expected) => {
    expect(getCartBadgeCount(count)).toBe(expected)
  })

  it.each([
    ['/en/checkout', true],
    ['/ar/checkout/confirmation/order-1', true],
    ['/en/login', true],
    ['/ar/register', true],
    ['/en/forgot-password', true],
    ['/ar/reset-password', true],
    ['/en/verify-email', true],
    ['/en/account', false],
  ])('identifies focus page %s', (path, expected) => {
    expect(isFocusPage(path)).toBe(expected)
  })
})
