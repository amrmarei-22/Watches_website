import { describe, expect, it } from 'vitest'
import { markEntranceSeen, shouldRunEntrance } from './entrance'

describe('Home entrance session gate', () => {
  it('runs once per session', () => {
    const values = new Map<string, string>()
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) } } as unknown as Storage
    expect(shouldRunEntrance(storage)).toBe(true)
    markEntranceSeen(storage)
    expect(shouldRunEntrance(storage)).toBe(false)
  })

  it('does not block when sessionStorage throws', () => {
    const storage = { getItem: () => { throw new Error('blocked') }, setItem: () => { throw new Error('blocked') } } as unknown as Storage
    expect(shouldRunEntrance(storage)).toBe(false)
    expect(() => markEntranceSeen(storage)).not.toThrow()
  })
})
