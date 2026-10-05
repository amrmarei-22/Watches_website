import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import ar from '../locales/ar.json'
import en from '../locales/en.json'

export const supportedLanguages = ['ar', 'en'] as const
export type i18nLanguage = (typeof supportedLanguages)[number]

const languageStorageKey = 'vintage-language'
const defaultLanguage: i18nLanguage = 'ar'

function getFallbackLanguage(language: string): i18nLanguage {
  return language === 'ar' ? 'en' : 'ar'
}

function isSupportedLanguage(value: string | null): value is i18nLanguage {
  return value !== null && supportedLanguages.includes(value as i18nLanguage)
}

function getInitialLanguage(): i18nLanguage {
  const storedLanguage = window.localStorage.getItem(languageStorageKey)
  return isSupportedLanguage(storedLanguage) ? storedLanguage : defaultLanguage
}

function updateDocumentLanguage(language: string): void {
  if (!isSupportedLanguage(language)) {
    return
  }

  document.documentElement.lang = language
  document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.dataset.language = language
}

void i18n
  .use(initReactI18next)
  .init({
    resources: {
      ar: { translation: ar },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: getFallbackLanguage,
    parseMissingKeyHandler: (key) => {
      if (import.meta.env.DEV) {
        console.error(`[i18n] Missing translation key: ${key}`)
        return key
      }
      return ''
    },
    interpolation: {
      escapeValue: false,
    },
  })

i18n.on('languageChanged', (language) => {
  updateDocumentLanguage(language)
  window.localStorage.setItem(languageStorageKey, language)
})

updateDocumentLanguage(i18n.language)

export function setLanguage(language: i18nLanguage): Promise<void> {
  return i18n.changeLanguage(language).then(() => undefined)
}

export default i18n
