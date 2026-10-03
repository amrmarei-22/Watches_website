import type { i18nLanguage } from '../lib/i18n'

const currencyLabels: Record<i18nLanguage, string> = {
  en: 'EGP',
  ar: 'ج.م',
}

export function formatMoney(minorUnits: number, language: i18nLanguage): string {
  const amount = minorUnits / 100
  const formatted = new Intl.NumberFormat(language, {
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
    numberingSystem: 'latn',
  }).format(amount)

  return `${formatted} ${currencyLabels[language]}`
}
