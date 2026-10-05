import { describe, expect, it } from 'vitest'
import { getFilledContactEntries } from './chromeLogic'

describe('chrome visibility', () => {
  it('hides empty contact values and promises', () => {
    expect(getFilledContactEntries({ whatsapp: '', phone: '010', email: '', hoursEn: '', hoursAr: '', instagram: '', facebook: '' })).toEqual([['phone', '010']])
  })
})
