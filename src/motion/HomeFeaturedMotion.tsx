import { useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product } from '../domain/types'
import { formatMoney } from '../domain/money'
import type { i18nLanguage } from '../lib/i18n'
import { getProductImageUrl } from '../features/catalog/imageUrl'
import { useReducedMotion } from './useReducedMotion'
import { shouldPinFeatured } from './shouldPinFeatured'
import { registerScrollTrigger } from './scrollScenes'

export function HomeFeaturedMotion({ products }: { products: Product[] }) {
  const { i18n, t } = useTranslation()
  const lang = i18n.language as i18nLanguage
  const reduced = useReducedMotion()
  const [activeIndex, setActiveIndex] = useState(0)
  const pin = typeof window !== 'undefined' && shouldPinFeatured(window.innerWidth, reduced)
  const scope = useRef<HTMLDivElement>(null)
  const product = products[activeIndex]
  const name = lang === 'ar' ? product.nameAr : product.nameEn
  const setIndex = (index: number) => setActiveIndex((index + products.length) % products.length)
  const specs = [
    ['movement', product.specs.movement],
    ['material', product.specs.material],
    ['caseSize', `${product.specs.caseSize} mm`],
  ] as const
  useGSAP(() => {
    if (!pin || !scope.current) return
    const ScrollTrigger = registerScrollTrigger()
    const trigger = ScrollTrigger.create({
      trigger: scope.current,
      pin: true,
      start: 'top top',
      end: () => `+=${products.length * window.innerHeight}`,
      pinSpacing: true,
      anticipatePin: 1,
    })
    return () => trigger.kill()
  }, { scope, dependencies: [pin, products.length] })

  return (
    <div ref={scope} className={`featured-showcase ${pin ? 'is-pinned' : 'is-fallback'}`}>
      <div className="featured-showcase-panel">
        <div className="featured-showcase-image"><img src={getProductImageUrl(product.images[0]?.path ?? '')} width="800" height="1000" loading="eager" alt={name} /></div>
        <div className="featured-showcase-copy">
          <span className="product-brand">{product.brand}</span>
          <h3>{name}</h3>
          <strong className="product-price">{formatMoney(product.price, lang)}</strong>
          <div className="showcase-specs">{specs.map(([key, value]) => <span key={key}>{key === 'caseSize' ? t('catalog.caseSize') : t(`specs.${key}.${value}`)}{key === 'caseSize' ? `: ${value}` : ''}</span>)}</div>
          <Link className="ui-button ui-button-primary" to={`/${lang}/products/${product.id}`}>{t('cta.viewWatch')}</Link>
        </div>
      </div>
      <div className="showcase-controls" aria-label={t('chrome.home.featured')}>
        <button type="button" className="showcase-arrow" aria-label={t('cta.previous')} onClick={() => setIndex(activeIndex - 1)}><ChevronLeft aria-hidden="true" /></button>
        <span>{t('chrome.home.sceneCounter', { current: String(activeIndex + 1).padStart(2, '0'), total: String(products.length).padStart(2, '0') })}</span>
        <div className="showcase-dots">{products.map((item, index) => <button type="button" key={item.id} aria-label={`${index + 1}`} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => setActiveIndex(index)} />)}</div>
        <button type="button" className="showcase-arrow" aria-label={t('cta.next')} onClick={() => setIndex(activeIndex + 1)}><ChevronRight aria-hidden="true" /></button>
      </div>
    </div>
  )
}
