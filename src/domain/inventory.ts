import {
  LOW_STOCK_THRESHOLD_DEFAULT,
  MAX_QTY_PER_LINE,
} from '../config/businessConfig'
import type { Availability, Product } from './types'

type InventoryProduct = Pick<
  Product,
  'stock' | 'lowStockThresholdOverride' | 'status'
>

export function getAvailability(
  product: Pick<Product, 'stock' | 'lowStockThresholdOverride'>,
): Availability {
  const threshold =
    product.lowStockThresholdOverride ?? LOW_STOCK_THRESHOLD_DEFAULT

  if (product.stock <= 0) {
    return 'OUT_OF_STOCK'
  }

  if (product.stock <= threshold) {
    return 'LOW_STOCK'
  }

  return 'IN_STOCK'
}

export function maxQuantity(product: InventoryProduct): number {
  if (product.status !== 'ACTIVE') {
    return 0
  }

  return Math.min(Math.max(product.stock, 0), MAX_QTY_PER_LINE)
}

export function canAddToCart(product: InventoryProduct, quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= maxQuantity(product)
}
