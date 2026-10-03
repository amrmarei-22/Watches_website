import { describe, expect, it } from 'vitest'
import type { Product } from '../../domain/types'
import {
  emptyCatalogFilters,
  filterAndSearchProducts,
  filterProducts,
  paginateProducts,
  sortProducts,
} from './catalogLogic'

const product = (overrides: Partial<Product> = {}): Product => ({
  id: 'a',
  sku: 'ABC-1',
  nameAr: 'ساعة اختبار',
  nameEn: 'Test Watch',
  brand: 'Vintage',
  descriptionAr: '',
  descriptionEn: '',
  price: 1000,
  stock: 4,
  lowStockThresholdOverride: null,
  status: 'ACTIVE',
  featured: false,
  images: [],
  specs: { caseSize: 40, movement: 'automatic', material: 'steel', waterResistance: 100, strap: 'leather', gender: 'men' },
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-01-01T00:00:00Z',
  ...overrides,
})

describe('catalog logic', () => {
  it('searches both names, brand, SKU, and treats an empty query as all', () => {
    const products = [product(), product({ id: 'b', sku: 'ROLEX-2', brand: 'Rolex', nameAr: 'أنيقة', nameEn: 'Elegant' })]
    expect(filterAndSearchProducts(products, 'test', emptyCatalogFilters(), 'en')).toHaveLength(1)
    expect(filterAndSearchProducts(products, 'انيقة', emptyCatalogFilters(), 'ar')).toHaveLength(1)
    expect(filterAndSearchProducts(products, 'rolex-2', emptyCatalogFilters(), 'en')).toHaveLength(1)
    expect(filterAndSearchProducts(products, '', emptyCatalogFilters(), 'en')).toHaveLength(2)
  })

  it('combines all filters with AND and counts low stock as in stock', () => {
    const filters = { ...emptyCatalogFilters(), brands: ['Vintage'], minPrice: 900, maxPrice: 1100, inStockOnly: true, genders: ['men'], movements: ['automatic'], materials: ['steel'] }
    expect(filterProducts([product(), product({ id: 'b', stock: 0 }), product({ id: 'c', specs: { ...product().specs, gender: 'women' } })], filters)).toHaveLength(1)
  })

  it.each([
    ['price-asc', ['b', 'a']],
    ['price-desc', ['a', 'b']],
  ] as const)('sorts by %s', (sort, ids) => {
    expect(sortProducts([product(), product({ id: 'b', price: 500 })], sort, 'en').map((item) => item.id)).toEqual(ids)
  })

  it('sorts names with the active language and breaks ties by date then id', () => {
    const result = sortProducts([product({ id: 'b', nameEn: 'Alpha', createdAt: '2024-01-01T00:00:00Z' }), product({ id: 'a', nameEn: 'Alpha' })], 'name', 'en')
    expect(result.map((item) => item.id)).toEqual(['a', 'b'])
  })

  it('paginates at twelve items and clamps invalid pages', () => {
    const products = Array.from({ length: 25 }, (_, index) => product({ id: String(index) }))
    expect(paginateProducts(products, 1).items).toHaveLength(12)
    expect(paginateProducts(products, 3).items).toHaveLength(1)
    expect(paginateProducts(products, 99).page).toBe(3)
  })
})
