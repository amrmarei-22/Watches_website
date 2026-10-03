import { describe, expect, it } from 'vitest'
import { buildStatusTimeline, IdempotencyKeyLifecycle, mapCheckoutError, orderTotalPreview } from './orderLogic'

describe('checkout and order logic', () => {
  it.each([
    ['CHECKOUT_STOCK_CONFLICT', 'stockConflict'],
    ['CART_PRICE_CHANGED', 'priceChanged'],
    ['CART_EMPTY', 'emptyCart'],
    ['AUTH_SESSION_EXPIRED', 'sessionExpired'],
    ['AUTH_VERIFY_REQUIRED', 'verifyRequired'],
    ['NETWORK', 'error'],
  ])('maps %s', (message, kind) => expect(mapCheckoutError({ message, details: '[{"product_id":"p1"}]' }).kind).toBe(kind))
  it('parses stock conflicts', () => expect(mapCheckoutError({ message: 'CHECKOUT_STOCK_CONFLICT', details: '[{"product_id":"p1"},{"product_id":"p2"}]' })).toEqual({ kind: 'stockConflict', productIds: ['p1', 'p2'] }))
  it('previews totals', () => expect(orderTotalPreview([{ unitPriceSnapshot: 100, quantity: 2 }, { unitPriceSnapshot: 50, quantity: 1 }], 25)).toEqual({ subtotal: 250, shippingFee: 25, total: 275 }))
  it('builds a chronological timeline', () => expect(buildStatusTimeline([{ from: null, to: 'PENDING', actorId: 'a', actorRole: 'CUSTOMER', reason: null, timestamp: '2026-01-02' }, { from: 'PENDING', to: 'CONFIRMED', actorId: 'a', actorRole: 'ADMIN', reason: null, timestamp: '2026-01-01' }]).map((entry) => entry.to)).toEqual(['CONFIRMED', 'PENDING']))
  it('reuses and discards an idempotency key', () => { const lifecycle = new IdempotencyKeyLifecycle(); const key = lifecycle.enterReview(); expect(lifecycle.enterReview()).toBe(key); lifecycle.discardAfterSuccess(); expect(lifecycle.current()).toBeNull(); expect(lifecycle.enterReview()).not.toBe(key) })
})
