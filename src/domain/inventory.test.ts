import { describe, expect, it } from 'vitest'
import {
  canAddToCart,
  getAvailability,
  maxQuantity,
} from './inventory'

const product = {
  stock: 4,
  lowStockThresholdOverride: null,
  status: 'ACTIVE' as const,
}

describe('inventory', () => {
  it.each([
    [0, 'OUT_OF_STOCK'],
    [1, 'LOW_STOCK'],
    [2, 'LOW_STOCK'],
    [3, 'LOW_STOCK'],
    [4, 'IN_STOCK'],
  ])('derives stock %s as %s', (stock, availability) => {
    expect(getAvailability({ ...product, stock })).toBe(availability)
  })

  it('uses a product threshold override', () => {
    expect(
      getAvailability({ stock: 4, lowStockThresholdOverride: 4 }),
    ).toBe('LOW_STOCK')
  })

  it.each([
    ['ACTIVE', 4, 3],
    ['ACTIVE', 1, 1],
    ['ACTIVE', 0, 0],
    ['DRAFT', 4, 0],
    ['ARCHIVED', 4, 0],
  ] as const)('calculates the maximum quantity for %s stock %s', (status, stock, expected) => {
    expect(maxQuantity({ ...product, status, stock })).toBe(expected)
  })

  it.each([
    [1, true],
    [3, true],
    [0, false],
    [4, false],
    [1.5, false],
  ])('allows cart quantity %s: %s', (quantity, expected) => {
    expect(canAddToCart(product, quantity)).toBe(expected)
  })

  it.each(['DRAFT', 'ARCHIVED'] as const)(
    'does not allow adding %s products',
    (status) => {
      expect(canAddToCart({ ...product, status }, 1)).toBe(false)
    },
  )
})
