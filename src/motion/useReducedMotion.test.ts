import { afterEach, describe, expect, it, vi } from 'vitest'
import { getReducedMotion, useReducedMotion } from './useReducedMotion'

const originalWindow = globalThis.window
afterEach(() => Object.defineProperty(globalThis, 'window', { configurable: true, value: originalWindow }))

describe('useReducedMotion', () => {
  it('reads the mocked media query', () => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: true }) } })
    expect(getReducedMotion()).toBe(true)
    Object.defineProperty(globalThis, 'window', { configurable: true, value: { matchMedia: () => ({ matches: false }) } })
    expect(getReducedMotion()).toBe(false)
    expect(useReducedMotion).toBeTypeOf('function')
    expect(vi).toBeDefined()
  })
})
