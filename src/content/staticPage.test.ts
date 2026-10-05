import { describe, expect, it } from 'vitest'
import { isContentPresent, parseMarkdown } from './staticPage'

describe('static page fallback', () => {
  it('detects empty content and parses supported markdown blocks', () => {
    expect(isContentPresent(' \n')).toBe(false)
    expect(isContentPresent('# Shipping')).toBe(true)
    expect(parseMarkdown('# Shipping\n\nA paragraph.\n\n- One\n- Two')).toEqual([
      { type: 'heading', level: 1, text: 'Shipping' },
      { type: 'paragraph', text: 'A paragraph.' },
      { type: 'list', ordered: false, items: ['One', 'Two'] },
    ])
  })
})
