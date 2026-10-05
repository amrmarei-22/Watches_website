import type { Product } from '../../domain/types'

export const homeGenders = ['men', 'women', 'unisex'] as const
export type HomeGender = (typeof homeGenders)[number]

function newestFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => {
    const dateDifference = Date.parse(b.createdAt) - Date.parse(a.createdAt)
    return dateDifference || a.id.localeCompare(b.id)
  })
}

export function getFeaturedProducts(products: Product[]): Product[] {
  return products.filter((product) => product.status === 'ACTIVE' && product.featured)
}

export function getNewArrivals(products: Product[], limit = 4): Product[] {
  return newestFirst(products).filter((product) => product.status === 'ACTIVE').slice(0, limit)
}

export function getLatestProductByGender(
  products: Product[],
  gender: HomeGender,
): Product | undefined {
  return newestFirst(products).find((product) => product.status === 'ACTIVE' && product.specs.gender === gender)
}

export function getBrands(products: Product[]): string[] {
  return [...new Set(products.map((product) => product.brand))].sort()
}
