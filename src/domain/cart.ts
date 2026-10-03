import { GUEST_CART_TTL_DAYS } from '../config/businessConfig'
import { canAddToCart, maxQuantity } from './inventory'
import type { Product } from './types'
import { z } from 'zod'

export interface GuestCartLine {
  productId: string
  quantity: number
  price_seen: number
}

export interface CartLine {
  product: Product
  quantity: number
  priceSeen: number
}

export interface CartChange {
  code: 'CART_PRICE_CHANGED' | 'CART_QTY_CLAMPED' | 'CART_ITEM_UNAVAILABLE'
  productId: string
  nameAr?: string
  nameEn?: string
  n?: number
}
const guestStorageSchema = z.object({ expiresAt: z.number(), items: z.array(z.object({ productId: z.string(), quantity: z.number().int().positive(), price_seen: z.number().int().nonnegative() })) })

export function parseGuestCartStorage(raw: string | null, now = Date.now()): { expiresAt: number; items: GuestCartLine[] } | null {
  if (!raw) return null
  try {
    const parsed = guestStorageSchema.safeParse(JSON.parse(raw))
    return parsed.success && !isGuestCartExpired(parsed.data.expiresAt, now) ? parsed.data : null
  } catch {
    return null
  }
}

export function guestCartExpiry(now = Date.now()): number {
  return now + GUEST_CART_TTL_DAYS * 24 * 60 * 60 * 1000
}

export function isGuestCartExpired(expiresAt: number, now = Date.now()): boolean {
  return !Number.isFinite(expiresAt) || expiresAt <= now
}

export function subtotal(lines: Pick<CartLine, 'product' | 'quantity'>[]): number {
  return lines.reduce((total, line) => total + line.product.price * line.quantity, 0)
}

export function mergeGuestLines(
  guestLines: GuestCartLine[],
  products: Product[],
): { lines: GuestCartLine[]; changes: CartChange[] } {
  const byId = new Map(products.map((product) => [product.id, product]))
  const changes: CartChange[] = []
  const lines: GuestCartLine[] = []
  for (const line of guestLines) {
    const product = byId.get(line.productId)
    if (!product || !canAddToCart(product, 1)) {
      changes.push({ code: 'CART_ITEM_UNAVAILABLE', productId: line.productId, nameAr: product?.nameAr, nameEn: product?.nameEn })
      continue
    }
    const max = maxQuantity(product)
    const quantity = Math.min(line.quantity, max)
    if (quantity !== line.quantity) changes.push({ code: 'CART_QTY_CLAMPED', productId: line.productId, n: quantity, nameAr: product.nameAr, nameEn: product.nameEn })
    lines.push({ ...line, quantity, price_seen: product.price })
  }
  return { lines, changes }
}

export function revalidateGuestLines(lines: CartLine[]): { lines: CartLine[]; changes: CartChange[] } {
  const changes: CartChange[] = []
  const next: CartLine[] = []
  for (const line of lines) {
    const { product } = line
    if (!canAddToCart(product, 1)) {
      changes.push({ code: 'CART_ITEM_UNAVAILABLE', productId: product.id, nameAr: product.nameAr, nameEn: product.nameEn })
      continue
    }
    if (line.priceSeen !== product.price) changes.push({ code: 'CART_PRICE_CHANGED', productId: product.id, nameAr: product.nameAr, nameEn: product.nameEn })
    const quantity = Math.min(line.quantity, maxQuantity(product))
    if (quantity !== line.quantity) changes.push({ code: 'CART_QTY_CLAMPED', productId: product.id, n: quantity, nameAr: product.nameAr, nameEn: product.nameEn })
    next.push({ ...line, quantity, priceSeen: product.price })
  }
  return { lines: next, changes }
}
