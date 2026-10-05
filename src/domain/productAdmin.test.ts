import { describe, expect, it } from 'vitest'
import { allowedProductActions, buildProductUpdatePayload, parsePriceToPiasters, reorderProductImages, setPrimaryProductImage } from './productAdmin'

describe('product admin rules', () => {
  it.each([
    ['DRAFT', ['PUBLISH', 'DELETE']],
    ['ACTIVE', ['UNPUBLISH', 'ARCHIVE']],
    ['ARCHIVED', ['PUBLISH', 'RESTORE']],
  ] as const)('allows legal actions for %s', (status, actions) => {
    expect(allowedProductActions(status, true)).toEqual(actions)
  })
  it('does not offer publish without images', () => {
    expect(allowedProductActions('DRAFT', false)).toEqual(['DELETE'])
    expect(allowedProductActions('ARCHIVED', false)).toEqual(['RESTORE'])
  })

  it.each([['1', 100], ['12.3', 1230], ['12.34', 1234], ['0.01', 1]] as const)(
    'converts %s EGP to piasters',
    (value, result) => expect(parsePriceToPiasters(value)).toBe(result),
  )

  it.each(['0', '-1', '1.234', 'abc', ''])('rejects invalid prices: %s', (value) => {
    expect(parsePriceToPiasters(value)).toBeNull()
  })

  it('builds an edit payload with only directly editable columns', () => {
    const payload = buildProductUpdatePayload({
      nameAr: 'ساعة',
      nameEn: 'Watch',
      brand: 'Brand',
      descriptionAr: 'وصف',
      descriptionEn: 'Description',
      price: 12500,
      lowStockThresholdOverride: 2,
      specs: { caseSize: 40, movement: 'automatic' },
    })
    expect(payload).toEqual({
      name_ar: 'ساعة',
      name_en: 'Watch',
      brand: 'Brand',
      description_ar: 'وصف',
      description_en: 'Description',
      price: 12500,
      low_stock_override: 2,
      specs: { caseSize: 40, movement: 'automatic' },
    })
    expect(Object.keys(payload).sort()).toEqual(['brand', 'description_ar', 'description_en', 'low_stock_override', 'name_ar', 'name_en', 'price', 'specs'])
  })

  it('reorders images and recalculates positions', () => {
    const images = [{ id: 'a', path: 'a', position: 0, is_primary: true }, { id: 'b', path: 'b', position: 1, is_primary: false }]
    expect(reorderProductImages(images, 'b', 'earlier').map((image) => image.id)).toEqual(['b', 'a'])
    expect(reorderProductImages(images, 'a', 'earlier')).toEqual(images)
  })

  it('sets one image primary', () => {
    const images = [{ id: 'a', path: 'a', position: 0, is_primary: true }, { id: 'b', path: 'b', position: 1, is_primary: false }]
    expect(setPrimaryProductImage(images, 'b').map((image) => image.is_primary)).toEqual([false, true])
  })
})
