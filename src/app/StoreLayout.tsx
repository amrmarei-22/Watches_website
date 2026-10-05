import { useEffect, useRef, useState, type ReactElement } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Logo } from '../components/Logo'
import { useAuthState } from '../hooks/useAuthState'
import { setLanguage, type i18nLanguage } from '../lib/i18n'
import { useCart } from '../hooks/useCart'
import { getProductImageUrl } from '../features/catalog/imageUrl'
import { Toast } from '../components/ui/Toast'
import { SmoothScroll } from '../motion'
import { businessConfig, brand } from '../config/businessConfig'
import { Menu, ShoppingBag, User } from 'lucide-react'

export function StoreLayout() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const authState = useAuthState()
  const cart = useCart()
  const drawerRef = useRef<HTMLElement>(null)
  const [scrolled, setScrolled] = useState(false)
  const [scrollProgress, setScrollProgress] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const lang = i18n.language as i18nLanguage
  const targetLanguage = lang === 'ar' ? 'en' : 'ar'
  const targetLanguageName = t(`nav.language${targetLanguage === 'ar' ? 'Arabic' : 'English'}`)
  const isHome = location.pathname === `/${lang}` || location.pathname === `/${lang}/`
  const isCustomer = authState.role === 'CUSTOMER'
  const accountLabel = isCustomer ? t('pages.account') : t('nav.login')
  const accountHref = isCustomer ? `/${lang}/account` : `/${lang}/login`
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight
      setScrollProgress(maxScroll > 0 ? Math.min(1, window.scrollY / maxScroll) : 0)
    }
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
        <summary className="icon-button account-link" aria-label={t('pages.account')} title={t('pages.account')}><User aria-hidden="true" /><span className="icon-label">{t('pages.account')}</span></summary>
        <div className="account-menu-items">
          <NavLink to={`/${lang}/account/orders`} end className="store-link">{t('pages.orders')}</NavLink>
          <button type="button" className="store-link account-logout" onClick={() => void authState.signOut()}>{t('nav.logout')}</button>
        </div>
      </details>
    ) : (
      <NavLink to={accountHref} end className="icon-button account-link" aria-label={accountLabel} title={accountLabel}><User aria-hidden="true" /><span className="icon-label">{accountLabel}</span></NavLink>
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
  const contactItems = [
    businessConfig.contact.whatsapp ? <a key="whatsapp" className="store-link" href={`https://wa.me/${businessConfig.contact.whatsapp}`}>{t('footer.whatsapp')}: {businessConfig.contact.whatsapp}</a> : null,
    businessConfig.contact.phone ? <a key="phone" className="store-link" href={`tel:${businessConfig.contact.phone}`}>{t('footer.phone')}: {businessConfig.contact.phone}</a> : null,
    businessConfig.contact.email ? <a key="email" className="store-link" href={`mailto:${businessConfig.contact.email}`}>{t('footer.email')}: {businessConfig.contact.email}</a> : null,
    (lang === 'ar' ? businessConfig.contact.hoursAr : businessConfig.contact.hoursEn) ? <span key="hours">{t('footer.hours')}: {lang === 'ar' ? businessConfig.contact.hoursAr : businessConfig.contact.hoursEn}</span> : null,
    businessConfig.contact.instagram ? <a key="instagram" className="store-link" href={businessConfig.contact.instagram}>{t('footer.instagram')}</a> : null,
    businessConfig.contact.facebook ? <a key="facebook" className="store-link" href={businessConfig.contact.facebook}>{t('footer.facebook')}</a> : null,
  ].filter((item): item is ReactElement => item !== null)
  useEffect(() => {
    if (authState.authError === 'AUTH_SESSION_EXPIRED') {
      navigate(`/${lang}/login?returnTo=${encodeURIComponent(location.pathname + location.search)}`, { replace: true })
    }
  }, [authState.authError, lang, location.pathname, location.search, navigate])
  useEffect(() => {
    if (!cart.drawerOpen) return
    const drawer = drawerRef.current
    if (!drawer) return
    const focusable = () => [...drawer.querySelectorAll<HTMLElement>('button, a, select, input, [tabindex]:not([tabindex="-1"])')]
    focusable()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { cart.closeDrawer(); return }
      if (event.key !== 'Tab') return
      const elements = focusable()
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    drawer.addEventListener('keydown', onKeyDown)
    return () => drawer.removeEventListener('keydown', onKeyDown)
  }, [cart.closeDrawer, cart.drawerOpen])
  return (
    <SmoothScroll><div className="store-shell">
      <header className={`store-header ${scrolled ? 'is-scrolled' : ''} ${isHome ? 'is-home' : 'is-inner-page'}`}>
        <div className="container store-header-inner">
          <Link to={`/${lang}`} className="logo-link" onClick={() => setMenuOpen(false)}><Logo /></Link>
          <nav className="desktop-nav" aria-label={t('nav.main')}>
            <NavLink to={`/${lang}`} end className="store-link">{t('nav.home')}</NavLink>
            <NavLink to={`/${lang}/shop`} end className="store-link">{t('nav.shop')}</NavLink>
          </nav>
          <span className="header-spacer" aria-hidden="true" />
          <div className="header-actions">
            {accountMenu}
            <NavLink to={`/${lang}/cart`} end className="icon-button cart-link" aria-label={t('nav.cart')} title={t('nav.cart')}><ShoppingBag aria-hidden="true" /><span className="icon-label">{t('nav.cart')}</span>{cart.count > 0 && <span className="cart-count">{cart.count}</span>}</NavLink>
            <button className="language-switch" lang={targetLanguage} aria-label={t('nav.switchLanguage', { language: targetLanguageName })} onClick={switchLanguage}>{targetLanguageName}</button>
            <button className="menu-button icon-button" onClick={() => setMenuOpen((open) => !open)} aria-expanded={menuOpen} aria-controls="mobile-menu" aria-label={t('nav.menu')} title={t('nav.menu')}><Menu aria-hidden="true" /></button>
          </div>
        </div>
        {menuOpen && <nav id="mobile-menu" className="mobile-menu" aria-label={t('nav.main')}>
          <NavLink to={`/${lang}`} end onClick={() => setMenuOpen(false)} className="store-link">{t('nav.home')}</NavLink>
          <NavLink to={`/${lang}/shop`} end onClick={() => setMenuOpen(false)} className="store-link">{t('nav.shop')}</NavLink>
          {mobileAccountMenu}
          <button type="button" className="store-link mobile-language" lang={targetLanguage} onClick={() => { setMenuOpen(false); void switchLanguage() }}>{targetLanguageName}</button>
        </nav>}
        <span className="scroll-progress" aria-hidden="true" style={{ transform: `scaleX(${scrollProgress})` }} />
      </header>
      {cart.drawerOpen && <aside ref={drawerRef} className="cart-drawer" aria-label={t('pages.cart')} role="dialog"><div className="cart-drawer-header"><h2>{t('pages.cart')}</h2><button type="button" onClick={cart.closeDrawer} aria-label={t('ui.close')}>{t('ui.close')}</button></div>{cart.items.map((item) => <div className="cart-drawer-line" key={item.product.id}><img src={getProductImageUrl(item.product.images[0]?.path ?? '')} alt="" /><span>{lang === 'ar' ? item.product.nameAr : item.product.nameEn}</span><span>{item.quantity}</span></div>)}<Link className="ui-button ui-button-primary" to={`/${lang}/cart`} onClick={cart.closeDrawer}>{t('pages.cart')}</Link></aside>}
      {cart.added && <Toast>{t('messages.CART_ADDED')}</Toast>}
      <main>{authState.authError === 'AUTH_DISABLED' && <div className="container form-alert" role="alert">{t('messages.AUTH_DISABLED')}</div>}{authState.authError === 'AUTH_SESSION_EXPIRED' && <div className="container form-alert" role="alert">{t('messages.AUTH_SESSION_EXPIRED')}</div>}<Outlet /></main>
      <footer className="store-footer">
        <div className="container footer-grid">
          <section className="footer-group footer-brand"><Logo />{(lang === 'ar' ? brand.taglineAr : brand.taglineEn) && <p>{lang === 'ar' ? brand.taglineAr : brand.taglineEn}</p>}<button type="button" className="language-switch" lang={targetLanguage} onClick={switchLanguage}>{targetLanguageName}</button></section>
          <section className="footer-group"><h2>{t('chrome.footer.help')}</h2><NavLink to={`/${lang}/contact`} className="store-link">{t('chrome.footer.contact')}</NavLink><NavLink to={`/${lang}/shipping`} className="store-link">{t('chrome.footer.shipping')}</NavLink><NavLink to={`/${lang}/privacy`} className="store-link">{t('chrome.footer.privacy')}</NavLink><NavLink to={`/${lang}/terms`} className="store-link">{t('chrome.footer.terms')}</NavLink>{contactItems.length > 0 && <address className="footer-contact">{contactItems}</address>}</section>
        </div>
        <div className="container footer-bottom"><span>© {new Date().getFullYear()} {lang === 'ar' ? brand.nameAr : brand.nameEn} — {t('chrome.footer.rights')}</span><span>{t('chrome.home.cod')} · {t('chrome.home.delivery')}</span></div>
      </footer>
    </div></SmoothScroll>
  )
}
