import { describe, expect, it } from 'vitest'
import { cairoDateRange, normalizeDashboardCounts, sanitizePostgrestSearch, transitionErrorCode } from './adminHelpers'

describe('admin helpers', () => {
  it('sanitizes PostgREST search metacharacters', () => {
    expect(sanitizePostgrestSearch(`WS-1,foo(bar)%*'"`)).toBe('WS-1foobar')
  })

  it('converts Cairo date boundaries to UTC timestamps', () => {
    const range = cairoDateRange('2026-01-01', '2026-01-01')
    expect(range.from).toMatch(/^2025-12-31T2[12]:00:00\.000Z$/)
    expect(range.to).toMatch(/^2026-01-01T2[12]:59:59\.999Z$/)
  })

  it('defaults missing dashboard statuses to zero', () => {
    const counts = normalizeDashboardCounts({ orders_by_status: { PENDING: 2 }, low_stock: null })
    expect(counts.orders).toEqual({ PENDING: 2, CONFIRMED: 0, PROCESSING: 0, SHIPPED: 0, DELIVERED: 0, CANCELLED: 0 })
    expect(counts.lowStock).toBe(0)
    expect(counts.outOfStock).toBe(0)
  })

  it.each(['ORDER_STATUS_CHANGED', 'ORDER_ILLEGAL_TRANSITION', 'REASON_REQUIRED', 'NOT_FOUND', 'FORBIDDEN'])(`maps %s`, (message) => {
    expect(transitionErrorCode(message)).toBe(message)
  })

  it('maps unknown transition errors to PAGE_500', () => {
    expect(transitionErrorCode('unexpected')).toBe('PAGE_500')
  })
})
