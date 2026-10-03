import type { OrderStatus, UserRole } from './types'

export type OrderAction =
  | 'CONFIRM'
  | 'CANCEL'
  | 'START_PROCESSING'
  | 'MARK_SHIPPED'
  | 'MARK_DELIVERED'

export interface TransitionInput {
  reason?: string | null
  tracking?: string | null
}

export interface OrderTransition {
  from: OrderStatus
  to: OrderStatus
  actor: Extract<UserRole, 'CUSTOMER' | 'ADMIN'>
  action: OrderAction
  reasonRequired: boolean
  trackingAllowed: boolean
}

const transitions: readonly OrderTransition[] = [
  {
    from: 'PENDING',
    to: 'CONFIRMED',
    actor: 'ADMIN',
    action: 'CONFIRM',
    reasonRequired: false,
    trackingAllowed: false,
  },
  {
    from: 'PENDING',
    to: 'CANCELLED',
    actor: 'CUSTOMER',
    action: 'CANCEL',
    reasonRequired: false,
    trackingAllowed: false,
  },
  {
    from: 'PENDING',
    to: 'CANCELLED',
    actor: 'ADMIN',
    action: 'CANCEL',
    reasonRequired: true,
    trackingAllowed: false,
  },
  {
    from: 'CONFIRMED',
    to: 'PROCESSING',
    actor: 'ADMIN',
    action: 'START_PROCESSING',
    reasonRequired: false,
    trackingAllowed: false,
  },
  {
    from: 'CONFIRMED',
    to: 'CANCELLED',
    actor: 'ADMIN',
    action: 'CANCEL',
    reasonRequired: true,
    trackingAllowed: false,
  },
  {
    from: 'PROCESSING',
    to: 'SHIPPED',
    actor: 'ADMIN',
    action: 'MARK_SHIPPED',
    reasonRequired: false,
    trackingAllowed: true,
  },
  {
    from: 'PROCESSING',
    to: 'CANCELLED',
    actor: 'ADMIN',
    action: 'CANCEL',
    reasonRequired: true,
    trackingAllowed: false,
  },
  {
    from: 'SHIPPED',
    to: 'DELIVERED',
    actor: 'ADMIN',
    action: 'MARK_DELIVERED',
    reasonRequired: false,
    trackingAllowed: false,
  },
] as const

const actionsByStatus: Readonly<Record<OrderStatus, readonly OrderAction[]>> = {
  PENDING: ['CANCEL', 'CONFIRM'],
  CONFIRMED: ['START_PROCESSING', 'CANCEL'],
  PROCESSING: ['MARK_SHIPPED', 'CANCEL'],
  SHIPPED: ['MARK_DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

export const orderTransitionTable = transitions

export function getLegalActions(status: OrderStatus, actor: UserRole): readonly OrderAction[] {
  if (actor === 'CUSTOMER') {
    return status === 'PENDING' ? ['CANCEL'] : []
  }

  if (actor === 'ADMIN') {
    return actionsByStatus[status]
  }

  return []
}

export function getTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: UserRole,
): OrderTransition | undefined {
  return transitions.find(
    (transition) =>
      transition.from === from &&
      transition.to === to &&
      transition.actor === actor,
  )
}

export function isValidTrackingNumber(tracking: string | null | undefined): boolean {
  return tracking === null || tracking === undefined || tracking.length <= 50
}

export function canTransition(
  from: OrderStatus,
  to: OrderStatus,
  actor: UserRole,
  input: TransitionInput = {},
): boolean {
  const transition = getTransition(from, to, actor)

  if (!transition || !isValidTrackingNumber(input.tracking)) {
    return false
  }

  if (transition.reasonRequired && !input.reason?.trim()) {
    return false
  }

  return !input.tracking || transition.trackingAllowed
}
