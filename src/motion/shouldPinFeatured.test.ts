import { describe, expect, it } from 'vitest'
import { shouldPinFeatured } from './shouldPinFeatured'

describe('shouldPinFeatured', () => {
  it('pins only on desktop without reduced motion', () => {
    expect(shouldPinFeatured(1024, false)).toBe(true)
    expect(shouldPinFeatured(1023, false)).toBe(false)
    expect(shouldPinFeatured(1280, true)).toBe(false)
  })
})
