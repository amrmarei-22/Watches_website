import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function Toast({ children, onDismiss }: { children: ReactNode; onDismiss?: () => void }) {
  const { t } = useTranslation()
  return <div className="ui-toast" role="status" aria-live="polite">{children}{onDismiss && <button className="ui-toast-dismiss" onClick={onDismiss} aria-label={t('ui.dismiss')}>×</button>}</div>
}
