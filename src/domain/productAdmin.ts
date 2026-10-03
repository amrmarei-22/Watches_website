import type { ProductStatus } from './types'

export type ProductAction = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE' | 'DELETE'

export function allowedProductActions(status: ProductStatus, hasImages: boolean): ProductAction[] {
  void hasImages
  if (status === 'DRAFT') return ['PUBLISH', 'DELETE']
  if (status === 'ACTIVE') return ['UNPUBLISH', 'ARCHIVE']
  return ['PUBLISH', 'RESTORE']
}

export function parsePriceToPiasters(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}
