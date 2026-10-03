import { useTranslation } from 'react-i18next'

type SkeletonProps = { className?: string; label?: string }
export function Skeleton({ className = '', label = 'Loading' }: SkeletonProps) {
  const { t } = useTranslation()
  return <span className={`ui-skeleton ${className}`} role="status" aria-label={label === 'Loading' ? t('ui.loading') : label} />
}
