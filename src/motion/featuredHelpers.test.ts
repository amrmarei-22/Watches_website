import { describe, expect, it } from 'vitest'
import { getActiveIndex, shouldAnimate } from './featuredHelpers'

describe('getActiveIndex', () => {
  it.each([
    [0, 4, 0], [0.249, 4, 0], [0.25, 4, 1], [0.5, 4, 2],
    [0.75, 4, 3], [1, 4, 3], [-1, 4, 0], [2, 4, 3], [0.5, 1, 0],
  ])('maps progress %s with n=%s to %s', (progress, count, expected) => {
    expect(getActiveIndex(progress, count)).toBe(expected)
  })
})

describe('shouldAnimate', () => {
  it.each([
    [{ reducedMotion: false, width: 1024 }, true],
    [{ reducedMotion: false, width: 1023 }, false],
    [{ reducedMotion: true, width: 1440 }, false],
  ])('returns %s for %o', (input, expected) => {
    expect(shouldAnimate(input)).toBe(expected)
  })
})
