import { describe, expect, it } from 'vitest'
import {
  canTransition,
  getLegalActions,
  orderTransitionTable,
} from './orderStateMachine'

describe('order state machine', () => {
  it.each(orderTransitionTable)(
    'allows $actor transition $from to $to',
    (transition) => {
      expect(
        canTransition(transition.from, transition.to, transition.actor, {
          reason: transition.reasonRequired ? 'Customer requested cancellation' : undefined,
          tracking: transition.trackingAllowed ? 'TRACK-123' : undefined,
        }),
      ).toBe(true)
    },
  )

  it('requires an admin cancellation reason', () => {
    expect(canTransition('PENDING', 'CANCELLED', 'ADMIN')).toBe(false)
    expect(canTransition('CONFIRMED', 'CANCELLED', 'ADMIN')).toBe(false)
    expect(canTransition('PROCESSING', 'CANCELLED', 'ADMIN')).toBe(false)
  })

  it('allows a customer cancellation without a reason', () => {
    expect(canTransition('PENDING', 'CANCELLED', 'CUSTOMER')).toBe(true)
  })

  it('validates optional tracking length for shipping', () => {
    expect(
      canTransition('PROCESSING', 'SHIPPED', 'ADMIN', {
        tracking: 'x'.repeat(50),
      }),
    ).toBe(true)
    expect(
      canTransition('PROCESSING', 'SHIPPED', 'ADMIN', {
        tracking: 'x'.repeat(51),
      }),
    ).toBe(false)
  })

  it.each([
    ['PENDING', 'CUSTOMER', ['CANCEL']],
    ['PENDING', 'ADMIN', ['CANCEL', 'CONFIRM']],
    ['CONFIRMED', 'CUSTOMER', []],
    ['CONFIRMED', 'ADMIN', ['START_PROCESSING', 'CANCEL']],
    ['PROCESSING', 'CUSTOMER', []],
    ['PROCESSING', 'ADMIN', ['MARK_SHIPPED', 'CANCEL']],
    ['SHIPPED', 'CUSTOMER', []],
    ['SHIPPED', 'ADMIN', ['MARK_DELIVERED']],
    ['DELIVERED', 'CUSTOMER', []],
    ['DELIVERED', 'ADMIN', []],
    ['CANCELLED', 'CUSTOMER', []],
    ['CANCELLED', 'ADMIN', []],
  ] as const)('lists legal actions for %s and %s', (status, actor, actions) => {
    expect(getLegalActions(status, actor)).toEqual(actions)
  })

  it.each([
    ['DELIVERED', 'PENDING'],
    ['CANCELLED', 'PENDING'],
    ['SHIPPED', 'CANCELLED'],
    ['SHIPPED', 'PROCESSING'],
    ['PENDING', 'SHIPPED'],
  ] as const)('rejects illegal transition %s to %s', (from, to) => {
    expect(canTransition(from, to, 'ADMIN', { reason: 'reason' })).toBe(false)
  })
})
