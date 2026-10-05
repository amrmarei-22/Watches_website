import { describe, expect, it } from 'vitest'
import type { Product } from '../../domain/types'
import { getLatestProductByGender, getNewArrivals } from './homeLogic'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'a',
  sku: 'A',
  nameAr: 'ساعة',
  nameEn: 'Watch',
  brand: 'Vintage',
  descriptionAr: '',
  descriptionEn: '',
  price: 100,
  stock: 1,
  lowStockThresholdOverride: null,
  status: 'ACTIVE',
  featured: false,
  images: [],
  specs: { caseSize: 40, movement: 'automatic', material: 'steel', waterResistance: 100, strap: 'leather', gender: 'men' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('home catalog selection', () => {
  it('selects the latest active product for each gender and hides inactive products', () => {
    const products = [
      product({ id: 'old', createdAt: '2024-01-01T00:00:00Z' }),
      product({ id: 'latest', createdAt: '2025-02-01T00:00:00Z' }),
      product({ id: 'draft', status: 'DRAFT', createdAt: '2026-01-01T00:00:00Z' }),
    ]
    expect(getLatestProductByGender(products, 'men')?.id).toBe('latest')
    expect(getLatestProductByGender(products, 'women')).toBeUndefined()
  })

  it('orders new arrivals by created_at descending and limits the result', () => {
    const products = Array.from({ length: 5 }, (_, index) => product({
      id: String(index),
      createdAt: `2025-01-0${index + 1}T00:00:00Z`,
    }))
    expect(getNewArrivals(products).map((item) => item.id)).toEqual(['4', '3', '2', '1'])
  })
})
