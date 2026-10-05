import { describe, expect, it } from 'vitest'
import ar from './ar.json'
import en from './en.json'

type LocaleValue = string | { [key: string]: LocaleValue }

const locales = {
  ar: ar as LocaleValue,
  en: en as LocaleValue,
}

function flatten(value: LocaleValue, prefix = ''): Record<string, string> {
  if (typeof value === 'string') return { [prefix]: value }
  return Object.entries(value).reduce<Record<string, string>>((result, [key, child]) => ({
    ...result,
    ...flatten(child, prefix ? `${prefix}.${key}` : key),
  }), {})
}

function ownKeys(value: LocaleValue): string[] {
  if (typeof value === 'string') return []
  return Object.entries(value).flatMap(([key, child]) => [key, ...ownKeys(child)])
}

const sourceFiles = import.meta.glob('../**/*.{ts,tsx}', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>

describe('i18nIntegrity', () => {
  it('keeps nested locale trees identical and review-free', () => {
    const arabic = flatten(locales.ar)
    const english = flatten(locales.en)
    expect(Object.keys(arabic).sort()).toEqual(Object.keys(english).sort())
    expect([...ownKeys(locales.ar), ...ownKeys(locales.en)].some((key) => key.includes('.'))).toBe(false)
    for (const [key, value] of Object.entries({ ...arabic, ...english })) {
      expect(value, key).not.toBe('')
      expect(value, key).not.toMatch(/\(مراجعة|TODO|needs review/i)
    }
  })

  it('defines every static translation key in both locales', () => {
    const keys = new Set<string>()
    const patterns = [
      /\bt\(\s*(['"])([^'"]+)\1/g,
      /\bi18nKey\s*=\s*(['"])([^'"]+)\1/g,
    ]
    for (const file of Object.keys(sourceFiles)) {
      const source = sourceFiles[file]
      for (const pattern of patterns) {
        for (const match of source.matchAll(pattern)) keys.add(match[2])
      }
    }
    const arabic = flatten(locales.ar)
    const english = flatten(locales.en)
    for (const key of keys) {
      expect(arabic, key).toHaveProperty(key)
      expect(english, key).toHaveProperty(key)
    }
  })
})
