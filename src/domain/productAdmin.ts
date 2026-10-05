import type { ProductStatus } from './types'

export type ProductAction = 'PUBLISH' | 'UNPUBLISH' | 'ARCHIVE' | 'RESTORE' | 'DELETE'
export type ProductUpdatePayload = {
  name_ar: string
  name_en: string
  brand: string
  description_ar: string
  description_en: string
  price: number
  low_stock_override: number | null
  specs: Record<string, string | number>
}

export type EditableProductImage = { id: string; path: string; position: number; is_primary: boolean }

export function allowedProductActions(status: ProductStatus, hasImages: boolean): ProductAction[] {
  if (status === 'DRAFT') return hasImages ? ['PUBLISH', 'DELETE'] : ['DELETE']
  if (status === 'ACTIVE') return ['UNPUBLISH', 'ARCHIVE']
  return hasImages ? ['PUBLISH', 'RESTORE'] : ['RESTORE']
}

export function parsePriceToPiasters(value: string): number | null {
  const normalized = value.trim().replace(',', '.')
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const amount = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return Number.isSafeInteger(amount) && amount > 0 ? amount : null
}

export function buildProductUpdatePayload(input: {
  nameAr: string
  nameEn: string
  brand: string
  descriptionAr: string
  descriptionEn: string
  price: number
  lowStockThresholdOverride: number | null
  specs: Record<string, string | number>
}): ProductUpdatePayload {
  return {
    name_ar: input.nameAr,
    name_en: input.nameEn,
    brand: input.brand,
    description_ar: input.descriptionAr,
    description_en: input.descriptionEn,
    price: input.price,
    low_stock_override: input.lowStockThresholdOverride,
    specs: input.specs,
  }
}

export function reorderProductImages(images: EditableProductImage[], imageId: string, direction: 'earlier' | 'later'): EditableProductImage[] {
  const current = images.findIndex((image) => image.id === imageId)
  const target = direction === 'earlier' ? current - 1 : current + 1
  if (current < 0 || target < 0 || target >= images.length) return images
  const next = [...images]
  const [moved] = next.splice(current, 1)
  next.splice(target, 0, moved)
  return next.map((image, position) => ({ ...image, position }))
}

export function setPrimaryProductImage(images: EditableProductImage[], imageId: string): EditableProductImage[] {
  return images.map((image) => ({ ...image, is_primary: image.id === imageId }))
}
