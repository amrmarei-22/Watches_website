import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/Logo'
import { useAuthState } from '../hooks/useAuthState'
import { setLanguage, type i18nLanguage } from '../lib/i18n'

export function StoreLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const authState = useAuthState()
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const lang = i18n.language as i18nLanguage
  const targetLanguage = lang === 'ar' ? 'en' : 'ar'
  const targetLanguageName = t(`nav.language${targetLanguage === 'ar' ? 'Arabic' : 'English'}`)
  const isCustomer = authState.role === 'CUSTOMER'
  const accountLabel = isCustomer ? t('pages.account') : t('nav.login')
  const accountHref = isCustomer ? `/${lang}/account` : `/${lang}/login`
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  const switchLanguage = async () => {
    await setLanguage(targetLanguage)
    const segments = location.pathname.split('/')
    segments[1] = targetLanguage
    navigate(segments.join('/') || `/${targetLanguage}`)
  }
  const accountMenu = (
    isCustomer ? (
      <details className="account-menu">
        <summary className="store-link">{t('pages.account')}</summary>
        <div className="account-menu-items">
          <NavLink to={`/${lang}/account/orders`} end className="store-link">{t('pages.orders')}</NavLink>
          <button type="button" className="store-link account-logout" onClick={() => void authState.signOut()}>{t('nav.logout')}</button>
        </div>
      </details>
    ) : (
      <NavLink to={accountHref} end className="store-link">{accountLabel}</NavLink>
    )
  )
  const mobileAccountMenu = isCustomer ? (
    <>
      <NavLink to={`/${lang}/account`} end onClick={() => setMenuOpen(false)} className="store-link">{t('pages.account')}</NavLink>
      <NavLink to={`/${lang}/account/orders`} end onClick={() => setMenuOpen(false)} className="store-link">{t('pages.orders')}</NavLink>
      <button type="button" className="store-link account-logout" onClick={() => { setMenuOpen(false); void authState.signOut() }}>{t('nav.logout')}</button>
    </>
  ) : (
    <NavLink to={accountHref} end onClick={() => setMenuOpen(false)} className="store-link">{accountLabel}</NavLink>
  )
  useEffect(() => {
    if (authState.authError === 'AUTH_SESSION_EXPIRED') {
      navigate(`/${lang}/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true })
    }
  }, [authState.authError, lang, location.pathname, location.search, navigate])
  return (
    <div className="store-shell">
      <header className={`store-header ${scrolled ? 'is-scrolled' : ''}`}>
        <div className="container store-header-inner">
          <Link to={`/${lang}`} className="logo-link" onClick={() => setMenuOpen(false)}><Logo /></Link>
          <nav className="desktop-nav" aria-label={t('nav.main')}>
            <NavLink to={`/${lang}/shop`} end className="store-link">{t('nav.shop')}</NavLink>
          </nav>
          <div className="header-actions">
            <button className="language-switch" lang={targetLanguage} aria-label={t('nav.switchLanguage', { language: targetLanguageName })} onClick={switchLanguage}>{targetLanguageName}</button>
            {accountMenu}
            <NavLink to={`/${lang}/cart`} end className="store-link cart-link">{t('nav.cart')} <span className="cart-count">0</span></NavLink>
            <button className="menu-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-menu">{t('nav.menu')}</button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-menu" className="mobile-menu" aria-label={t('nav.main')}>
          <NavLink to={`/${lang}/shop`} end onClick={() => setMenuOpen(false)} className="store-link">{t('nav.shop')}</NavLink>
          {mobileAccountMenu}
          <NavLink to={`/${lang}/cart`} end onClick={() => setMenuOpen(false)} className="store-link">{t('nav.cart')} <span className="cart-count">0</span></NavLink>
        </nav>}
      </header>
      <main>{authState.authError === 'AUTH_DISABLED' && <div className="container form-alert" role="alert">{t('messages.AUTH_DISABLED')}</div>}{authState.authError === 'AUTH_SESSION_EXPIRED' && <div className="container form-alert" role="alert">{t('messages.AUTH_SESSION_EXPIRED')}</div>}<Outlet /></main>
      <footer className="store-footer"><div className="container footer-inner"><Logo /><nav aria-label={t('nav.footer')}><NavLink to={`/${lang}/shop`} end className="store-link">{t('nav.shop')}</NavLink>{isCustomer ? accountMenu : <NavLink to={accountHref} end className="store-link">{accountLabel}</NavLink>}</nav></div></footer>
    </div>
  )
}
