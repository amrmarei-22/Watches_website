import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getDirection } from './useDirection'

let previousDocument: typeof globalThis.document | undefined
beforeEach(() => {
  previousDocument = globalThis.document
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { documentElement: { dir: '' } } })
})
afterEach(() => { Object.defineProperty(globalThis, 'document', { configurable: true, value: previousDocument }) })

describe('getDirection', () => {
  it('returns direction from html dir', () => {
    document.documentElement.dir = 'rtl'
    expect(getDirection()).toBe(-1)
    document.documentElement.dir = 'ltr'
    expect(getDirection()).toBe(1)
  })
})
