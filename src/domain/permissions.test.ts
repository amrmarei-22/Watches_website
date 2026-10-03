import { describe, expect, it } from 'vitest'
import { canViewProduct, hasPermission } from './permissions'

describe('permissions matrix', () => {
  it.each([
    ['GUEST', 'VIEW_ACTIVE_PRODUCTS', true],
    ['CUSTOMER', 'VIEW_ACTIVE_PRODUCTS', true],
    ['ADMIN', 'VIEW_ACTIVE_PRODUCTS', true],
    ['GUEST', 'VIEW_NON_ACTIVE_PRODUCTS', false],
    ['CUSTOMER', 'VIEW_NON_ACTIVE_PRODUCTS', false],
    ['ADMIN', 'VIEW_NON_ACTIVE_PRODUCTS', true],
    ['GUEST', 'ADD_TO_CART', true],
    ['CUSTOMER', 'ADD_TO_CART', true],
    ['ADMIN', 'ADD_TO_CART', false],
    ['GUEST', 'CHECKOUT', false],
    ['CUSTOMER', 'CHECKOUT', true],
    ['ADMIN', 'CHECKOUT', false],
    ['GUEST', 'VIEW_OWN_ORDERS', false],
    ['CUSTOMER', 'VIEW_OWN_ORDERS', true],
    ['ADMIN', 'VIEW_OWN_ORDERS', false],
    ['GUEST', 'VIEW_ANY_ORDER', false],
    ['CUSTOMER', 'VIEW_ANY_ORDER', false],
    ['ADMIN', 'VIEW_ANY_ORDER', true],
    ['GUEST', 'CANCEL_OWN_ORDER', false],
    ['CUSTOMER', 'CANCEL_OWN_ORDER', true],
    ['ADMIN', 'CANCEL_OWN_ORDER', false],
    ['GUEST', 'MANAGE_PROFILE_ADDRESSES', false],
    ['CUSTOMER', 'MANAGE_PROFILE_ADDRESSES', true],
    ['ADMIN', 'MANAGE_PROFILE_ADDRESSES', false],
    ['GUEST', 'MANAGE_ADMIN_AREA', false],
    ['CUSTOMER', 'MANAGE_ADMIN_AREA', false],
    ['ADMIN', 'MANAGE_ADMIN_AREA', true],
  ] as const)(
    'returns %s for %s with %s',
    (actor, permission, expected) => {
      const context =
        permission === 'CHECKOUT'
          ? { emailVerified: true }
          : permission === 'CANCEL_OWN_ORDER'
            ? { orderOwner: true, orderStatus: 'PENDING' as const }
            : undefined

      expect(hasPermission(actor, permission, context)).toBe(expected)
    },
  )

  it('requires a verified customer for checkout', () => {
    expect(hasPermission('CUSTOMER', 'CHECKOUT')).toBe(false)
  })

  it('requires ownership and PENDING status for customer cancellation', () => {
    expect(
      hasPermission('CUSTOMER', 'CANCEL_OWN_ORDER', {
        orderOwner: false,
        orderStatus: 'PENDING',
      }),
    ).toBe(false)
    expect(
      hasPermission('CUSTOMER', 'CANCEL_OWN_ORDER', {
        orderOwner: true,
        orderStatus: 'CONFIRMED',
      }),
    ).toBe(false)
  })

  it('applies the product visibility rule', () => {
    expect(canViewProduct('GUEST', true)).toBe(true)
    expect(canViewProduct('CUSTOMER', false)).toBe(false)
    expect(canViewProduct('ADMIN', false)).toBe(true)
  })
})
