import { useTranslation } from 'react-i18next'
import { brand } from '../config/businessConfig'

export function Logo() {
  const { i18n } = useTranslation()
  const isArabic = i18n.language === 'ar'
  return (
    <span className="logo" aria-label={isArabic ? brand.nameAr : brand.nameEn}>
      <img src="/logo-mark.svg" width="32" height="32" alt="" aria-hidden="true" />
      <span className="logo-wordmark">{isArabic ? brand.nameAr : brand.nameEn.toUpperCase()}</span>
    </span>
  )
}
