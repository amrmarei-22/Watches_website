import type { OrderStatus, PaymentStatus } from '../domain/types'

export const adminOrderStatuses: readonly OrderStatus[] = [
  'PENDING',
  'PENDING_VERIFICATION',
  'PAID',
  'CONFIRMED',
  'PROCESSING',
  'SHIPPED',
  'DELIVERED',
  'CANCELLED',
]

type OrderBadgeState =
  | { kind: 'order'; value: OrderStatus; orderCancelled?: boolean }
  | { kind: 'payment'; value: PaymentStatus; orderCancelled?: boolean }

export function getOrderBadgePresentation(
  state: OrderBadgeState,
): { labelKey: string; tone: string } {
  if (state.kind === 'order') {
    const status = state.value
    const tones: Record<OrderStatus, string> = {
      PENDING: 'warning',
      PENDING_VERIFICATION: 'warning',
      PAID: 'success',
      CONFIRMED: 'success',
      PROCESSING: 'accent',
      SHIPPED: 'accent',
      DELIVERED: 'success',
      CANCELLED: 'muted',
    }
    return { labelKey: `orderStatus.${status}`, tone: `admin-badge--${tones[status]}` }
  }

  const status = state.value
  if (state.orderCancelled && status === 'awaiting_payment') {
    return { labelKey: 'admin.paymentNotRequired', tone: 'admin-badge--muted' }
  }
  const tones: Record<PaymentStatus, string> = {
    awaiting_payment: 'warning',
    under_review: 'accent',
    paid: 'success',
    rejected: 'danger',
    refunded: 'muted',
  }
  return {
    labelKey: `paymentStatus.${status}`,
    tone: `admin-badge--${state.orderCancelled ? 'muted' : tones[status]}`,
  }
}

export function parseAddressSnapshot(value: unknown): Record<string, string> {
  let snapshot: unknown = value
  if (typeof snapshot === 'string') {
    const raw = snapshot
    try {
      snapshot = JSON.parse(raw) as unknown
    } catch {
      const [fullName = '', city = '', governorate = ''] = raw
        .split(',')
        .map((part) => part.trim())
      return { full_name: fullName, city, governorate }
    }
  }
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return {}

  const record = snapshot as Record<string, unknown>
  const aliases: Record<string, string[]> = {
    full_name: ['full_name', 'fullName', 'name'],
    phone: ['phone', 'customer_phone'],
    governorate: ['governorate', 'state'],
    city: ['city', 'area'],
    street: ['street', 'address', 'address_line'],
    building: ['building', 'unit', 'apartment'],
    notes: ['notes', 'customer_notes'],
  }
  const result: Record<string, string> = {}
  for (const [field, keys] of Object.entries(aliases)) {
    const candidate = keys.map((key) => record[key]).find((item) => typeof item === 'string' || typeof item === 'number')
    if (candidate !== undefined) result[field] = String(candidate)
  }
  return result
}

export function sanitizeAdminText(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0)
      return !(code <= 8 || code === 11 || code === 12 || (code >= 14 && code <= 31) || code === 127)
    })
    .join('')
    .trim()
}

export function logAdminDataError(
  operation: string,
  error: { message: string; code?: string; details?: string },
): void {
  console.error(`[admin] ${operation} failed`, {
    message: error.message,
    code: error.code,
    details: error.details,
  })
}

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
  return ['ORDER_STATUS_CHANGED', 'ORDER_ILLEGAL_TRANSITION', 'REASON_REQUIRED', 'INVALID_INPUT', 'NOT_FOUND', 'FORBIDDEN'].includes(message)
    ? message
    : 'PAGE_500'
}
