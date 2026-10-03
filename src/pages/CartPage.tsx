import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { formatMoney } from '../domain/money'
import { maxQuantity } from '../domain/inventory'
import { getProductImageUrl } from '../features/catalog/imageUrl'
import { useAuthState } from '../hooks/useAuthState'
import { useCart } from '../hooks/useCart'
import type { i18nLanguage } from '../lib/i18n'

export function CartPage() {
  const { t, i18n } = useTranslation()
  const lang = i18n.language as i18nLanguage
  const navigate = useNavigate()
  const auth = useAuthState()
  const cart = useCart()
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    void cart.revalidate().catch(() => setFailed(true)).finally(() => setLoading(false))
  }, [])
  const checkout = () => {
    if (auth.role === 'GUEST') navigate(`/${lang}/login?returnTo=${encodeURIComponent(`/${lang}/checkout`)}`)
    else if (!auth.emailVerified) navigate(`/${lang}/verify-email`)
    else navigate(`/${lang}/checkout`)
  }
  if (loading) return <section className="container cart-page"><Skeleton className="listing-skeleton" /></section>
  if (failed || cart.error) return <ErrorState message={t(`messages.${cart.error ?? 'PAGE_500'}`, { defaultValue: t('messages.PAGE_500') })} action={t('actions.tryAgain')} onAction={() => { setFailed(false); setLoading(true); void cart.revalidate().catch(() => setFailed(true)).finally(() => setLoading(false)) }} />
  if (!cart.items.length) return <EmptyState message={t('messages.CART_EMPTY')} action={t('actions.continueShopping')} onAction={() => navigate(`/${lang}/shop`)} />
  return <section className="container cart-page"><h1 className="page-heading">{t('pages.cart')}</h1><div className="cart-lines">{cart.items.map((item) => <article className="cart-line" key={item.product.id}><img src={getProductImageUrl(item.product.images[0]?.path ?? '')} alt={lang === 'ar' ? item.product.nameAr : item.product.nameEn} /><div><h2>{lang === 'ar' ? item.product.nameAr : item.product.nameEn}</h2><p>{formatMoney(item.product.price, lang)}</p></div><label>{t('catalog.quantity')}<select value={item.quantity} onChange={(event) => void cart.setQuantity(item.product.id, Number(event.target.value))}>{Array.from({ length: maxQuantity(item.product) }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><Button variant="text" onClick={() => void cart.removeItem(item.product.id)}>{t('cart.remove')}</Button></article>)}</div><div className="cart-summary"><strong>{formatMoney(cart.subtotal, lang)}</strong><Button onClick={checkout}>{t('cart.checkout')}</Button></div><Link to={`/${lang}/shop`}>{t('actions.continueShopping')}</Link></section>
}
