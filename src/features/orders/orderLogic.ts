import type { OrderLine, OrderStatus, StatusHistoryEntry } from '../../domain/types'

export type CheckoutErrorAction =
  | { kind: 'stockConflict'; productIds: string[] }
  | { kind: 'priceChanged' }
  | { kind: 'emptyCart' }
  | { kind: 'sessionExpired' }
  | { kind: 'verifyRequired' }
  | { kind: 'error' }

export function mapCheckoutError(error: { message?: string; details?: string } | null): CheckoutErrorAction {
  const code = error?.message ?? ''
  if (code === 'CHECKOUT_STOCK_CONFLICT') {
    try {
      const details = JSON.parse(error?.details ?? '[]') as Array<{ product_id?: string }>
      return { kind: 'stockConflict', productIds: details.flatMap((item) => item.product_id ? [item.product_id] : []) }
    } catch {
      return { kind: 'stockConflict', productIds: [] }
    }
  }
  if (code === 'CART_PRICE_CHANGED') return { kind: 'priceChanged' }
  if (code === 'CART_EMPTY') return { kind: 'emptyCart' }
  if (code === 'AUTH_SESSION_EXPIRED') return { kind: 'sessionExpired' }
  if (code === 'AUTH_VERIFY_REQUIRED') return { kind: 'verifyRequired' }
  return { kind: 'error' }
}

export function orderTotalPreview(lines: Pick<OrderLine, 'unitPriceSnapshot' | 'quantity'>[], shippingFee: number) {
  const subtotal = lines.reduce((sum, line) => sum + line.unitPriceSnapshot * line.quantity, 0)
  return { subtotal, shippingFee, total: subtotal + shippingFee }
}

export function buildStatusTimeline(history: StatusHistoryEntry[]): StatusHistoryEntry[] {
  return [...history].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
}

export function canCustomerCancel(status: OrderStatus): boolean {
  return status === 'PENDING'
}

export class IdempotencyKeyLifecycle {
  private key: string | null = null
  enterReview(): string {
    this.key ??= crypto.randomUUID()
    return this.key
  }
  current(): string | null { return this.key }
  discardAfterSuccess(): void { this.key = null }
}
