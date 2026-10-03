import { describe, expect, it } from 'vitest'
import { allowedProductActions, parsePriceToPiasters } from './productAdmin'

describe('product admin rules', () => {
  it.each([
    ['DRAFT', ['PUBLISH', 'DELETE']],
    ['ACTIVE', ['UNPUBLISH', 'ARCHIVE']],
    ['ARCHIVED', ['PUBLISH', 'RESTORE']],
  ] as const)('allows legal actions for %s', (status, actions) => {
    expect(allowedProductActions(status, true)).toEqual(actions)
  })

  it.each([['1', 100], ['12.3', 1230], ['12.34', 1234], ['0.01', 1]] as const)(
    'converts %s EGP to piasters',
    (value, result) => expect(parsePriceToPiasters(value)).toBe(result),
  )

  it.each(['0', '-1', '1.234', 'abc', ''])('rejects invalid prices: %s', (value) => {
    expect(parsePriceToPiasters(value)).toBeNull()
  })
})
