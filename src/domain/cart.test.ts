import { describe, expect, it } from 'vitest'
import { isGuestCartExpired, mergeGuestLines, parseGuestCartStorage, revalidateGuestLines, subtotal } from './cart'
import type { Product } from './types'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'p1', sku: 'SKU', nameAr: 'ساعة', nameEn: 'Watch', brand: 'Brand',
  descriptionAr: '', descriptionEn: '', price: 1000, stock: 3, lowStockThresholdOverride: null,
  status: 'ACTIVE', featured: false, images: [], specs: { caseSize: 40, movement: 'quartz', material: 'steel', waterResistance: 30, strap: 'leather', gender: 'unisex' },
  createdAt: '', updatedAt: '', ...overrides,
})

describe('cart logic', () => {
  it('merges and clamps guest lines', () => {
    const result = mergeGuestLines([{ productId: 'p1', quantity: 9, price_seen: 1000 }], [product()])
    expect(result.lines[0].quantity).toBe(3)
    expect(result.changes[0].code).toBe('CART_QTY_CLAMPED')
  })
  it('computes subtotal', () => expect(subtotal([{ product: product({ price: 1250 }), quantity: 2 }])).toBe(2500))
  it('detects expiry and discards tampered storage', () => {
    expect(isGuestCartExpired(10, 11)).toBe(true)
    expect(parseGuestCartStorage('{"items":"tampered"}')).toBeNull()
  })
  it('reports price, stock and unavailable changes', () => {
    const result = revalidateGuestLines([
      { product: product({ price: 1200 }), quantity: 2, priceSeen: 1000 },
      { product: product({ id: 'p2', stock: 1 }), quantity: 2, priceSeen: 1000 },
      { product: product({ id: 'p3', status: 'ARCHIVED' }), quantity: 1, priceSeen: 1000 },
    ])
    expect(result.changes.map((change) => change.code)).toEqual(['CART_PRICE_CHANGED', 'CART_QTY_CLAMPED', 'CART_ITEM_UNAVAILABLE'])
  })
})
