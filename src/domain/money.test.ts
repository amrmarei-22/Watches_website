import { describe, expect, it } from 'vitest'
import { formatMoney } from './money'

describe('formatMoney', () => {
  it('omits decimals for whole pounds', () => {
    expect(formatMoney(1_250_000, 'ar')).toBe('12,500 ج.م')
    expect(formatMoney(1_250_000, 'en')).toBe('12,500 EGP')
  })

  it('shows two decimals for fractional pounds', () => {
    expect(formatMoney(1_250_050, 'ar')).toBe('12,500.50 ج.م')
    expect(formatMoney(1_250_050, 'en')).toBe('12,500.50 EGP')
  })
})
