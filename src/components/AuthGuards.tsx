import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuthState } from '../hooks/useAuthState'

export function RequireAuth() {
  const { role, loading } = useAuthState(); const location = useLocation(); const { t } = useTranslation()
  if (loading) return <div className="container auth-loading" aria-live="polite">{t('ui.loading')}</div>
  return role === 'GUEST' ? <Navigate to={`/${location.pathname.split('/')[1]}/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace /> : <Outlet />
}

export function RequireCustomer() {
  const { role, loading } = useAuthState(); const location = useLocation(); const { t, i18n } = useTranslation()
  if (loading) return <div className="container auth-loading" aria-live="polite">{t('ui.loading')}</div>
  if (role === 'GUEST') return <Navigate to={`/${i18n.language}/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`} replace />
  if (role === 'ADMIN') return <Navigate to={`/${i18n.language}/403`} replace />
  return <Outlet />
}

export function RequireVerified() {
  const { role, emailVerified } = useAuthState(); const { t, i18n } = useTranslation()
  if (role === 'GUEST') return <Navigate to={`/${i18n.language}/login?returnTo=${encodeURIComponent(window.location.pathname)}`} replace />
  if (role === 'ADMIN') return <Navigate to={`/${i18n.language}/403`} replace />
  if (!emailVerified) return <div className="container auth-page"><div className="auth-card"><div className="form-alert" role="alert">{t('messages.AUTH_VERIFY_REQUIRED')}</div><a href={`/${i18n.language}/verify-email`}>{t('actions.resendLink')}</a></div></div>
  return <Outlet />
}

export function RequireAdmin() {
  const { role, loading } = useAuthState(); const { t } = useTranslation()
  if (loading) return <div className="container auth-loading" aria-live="polite">{t('ui.loading')}</div>
  if (role === 'GUEST') return <Navigate to="/admin/login" replace />
  if (role !== 'ADMIN') return <div className="container auth-page"><div className="auth-card"><div className="form-alert" role="alert">{t('messages.PAGE_403')}</div></div></div>
  return <Outlet />
}
