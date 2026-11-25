import { describe, expect, it } from 'vitest'
import { getCairoHandAngles } from './heroWatchTime'

describe('getCairoHandAngles', () => {
  it('uses Cairo time and includes fractional seconds for smooth movement', () => {
    const angles = getCairoHandAngles(Date.parse('2026-11-25T23:15:30.500Z'))

    expect(angles.hour).toBeCloseTo(37.7541667, 5)
    expect(angles.minute).toBeCloseTo(93.05, 5)
    expect(angles.second).toBe(183)
  })
})
