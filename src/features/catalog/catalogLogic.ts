import { getAvailability } from '../../domain/inventory'
import { PAGE_SIZE } from '../../config/businessConfig'
import type { Availability, Product } from '../../domain/types'
import type { i18nLanguage } from '../../lib/i18n'

export type CatalogSort = 'newest' | 'price-asc' | 'price-desc' | 'name'

export interface CatalogFilters {
  brands: string[]
  minPrice?: number
  maxPrice?: number
  inStockOnly: boolean
  genders: string[]
  movements: string[]
  materials: string[]
}

export const emptyCatalogFilters = (): CatalogFilters => ({
  brands: [],
  inStockOnly: false,
  genders: [],
  movements: [],
  materials: [],
})

export function normalizeArabic(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
}

function normalize(value: string, language: i18nLanguage): string {
  const normalized = language === 'ar' ? normalizeArabic(value) : value
  return normalized.toLocaleLowerCase(language)
}

export function matchesSearch(
  product: Product,
  query: string,
  language: i18nLanguage,
): boolean {
  const needle = normalize(query.trim(), language)
  if (!needle) return true
  return [product.nameAr, product.nameEn, product.brand, product.sku]
    .some((value) => normalize(value, language).includes(needle))
}

export function filterProducts(
  products: Product[],
  filters: CatalogFilters,
): Product[] {
  return products.filter((product) => {
    const availability = getAvailability(product)
    return (
      (filters.brands.length === 0 || filters.brands.includes(product.brand)) &&
      (filters.minPrice === undefined || product.price >= filters.minPrice) &&
      (filters.maxPrice === undefined || product.price <= filters.maxPrice) &&
      (!filters.inStockOnly || availability !== 'OUT_OF_STOCK') &&
      (filters.genders.length === 0 || filters.genders.includes(product.specs.gender)) &&
      (filters.movements.length === 0 || filters.movements.includes(product.specs.movement)) &&
      (filters.materials.length === 0 || filters.materials.includes(product.specs.material))
    )
  })
}

export function filterAndSearchProducts(
  products: Product[],
  query: string,
  filters: CatalogFilters,
  language: i18nLanguage,
): Product[] {
  return filterProducts(products, filters).filter((product) =>
    matchesSearch(product, query, language),
  )
}

function compareCreatedAtThenId(a: Product, b: Product): number {
  const dateDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt)
  return dateDifference || a.id.localeCompare(b.id)
}

export function sortProducts(
  products: Product[],
  sort: CatalogSort,
  language: i18nLanguage,
): Product[] {
  const collator = new Intl.Collator(language, { sensitivity: 'base' })
  return [...products].sort((a, b) => {
    if (sort === 'price-asc' && a.price !== b.price) return a.price - b.price
    if (sort === 'price-desc' && a.price !== b.price) return b.price - a.price
    if (sort === 'name') {
      const nameDifference = collator.compare(
        language === 'ar' ? a.nameAr : a.nameEn,
        language === 'ar' ? b.nameAr : b.nameEn,
      )
      if (nameDifference) return nameDifference
    }
    return compareCreatedAtThenId(a, b)
  })
}

export function paginateProducts(
  products: Product[],
  page: number,
  pageSize = PAGE_SIZE,
): { items: Product[]; page: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(products.length / pageSize))
  const safePage = Math.min(Math.max(1, page), pageCount)
  return {
    items: products.slice((safePage - 1) * pageSize, safePage * pageSize),
    page: safePage,
    pageCount,
  }
}

export function getAvailabilityLabel(
  availability: Availability,
  stock: number,
): { key: string; count?: number } {
  if (availability === 'LOW_STOCK') return { key: 'messages.PRODUCT_LOW_STOCK', count: stock }
  if (availability === 'OUT_OF_STOCK') return { key: 'messages.PRODUCT_OUT_OF_STOCK' }
  return { key: 'availability.IN_STOCK' }
}
