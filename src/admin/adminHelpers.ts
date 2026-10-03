import type { OrderStatus } from '../domain/types'

export const adminOrderStatuses: readonly OrderStatus[] = [
  'PENDING',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

export function sanitizePostgrestSearch(value: string): string {
  return value.replace(/[(),%*'"]/g, '').trim()
}

function cairoOffsetMinutes(date: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Africa/Cairo',
    timeZoneName: 'longOffset',
  }).formatToParts(date)
  const zone = parts.find((part) => part.type === 'timeZoneName')?.value ?? 'GMT'
  const match = zone.match(/GMT([+-])(\d{2}):?(\d{2})?/)
  if (!match) return 0
  return (match[1] === '-' ? -1 : 1) * (Number(match[2]) * 60 + Number(match[3] ?? 0))
}

function cairoMidnight(dateText: string): Date {
  const [year, month, day] = dateText.split('-').map(Number)
  const candidate = new Date(Date.UTC(year, month - 1, day))
  return new Date(candidate.getTime() - cairoOffsetMinutes(candidate) * 60_000)
}

export function cairoDateRange(start: string, end: string): { from: string | null; to: string | null } {
  const from = start ? cairoMidnight(start) : null
  const to = end ? new Date(cairoMidnight(end).getTime() + 86_400_000 - 1) : null
  return { from: from?.toISOString() ?? null, to: to?.toISOString() ?? null }
}

export function normalizeDashboardCounts(value: unknown): {
  orders: Record<OrderStatus, number>
  lowStock: number
  outOfStock: number
} {
  const raw = (value ?? {}) as { orders_by_status?: unknown; low_stock?: unknown; out_of_stock?: unknown }
  const orders = Object.fromEntries(adminOrderStatuses.map((status) => [status, 0])) as Record<OrderStatus, number>
  if (Array.isArray(raw.orders_by_status)) {
    for (const item of raw.orders_by_status) {
      const row = item as { status?: OrderStatus; count?: number }
      if (row.status && adminOrderStatuses.includes(row.status)) orders[row.status] = Number(row.count ?? 0)
    }
  } else if (raw.orders_by_status && typeof raw.orders_by_status === 'object') {
    for (const status of adminOrderStatuses) orders[status] = Number((raw.orders_by_status as Record<string, number>)[status] ?? 0)
  }
  return { orders, lowStock: Number(raw.low_stock ?? 0), outOfStock: Number(raw.out_of_stock ?? 0) }
}

export function transitionErrorCode(message: string): string {
  return ['ORDER_STATUS_CHANGED', 'ORDER_ILLEGAL_TRANSITION', 'REASON_REQUIRED', 'NOT_FOUND', 'FORBIDDEN'].includes(message)
    ? message
    : 'PAGE_500'
}
