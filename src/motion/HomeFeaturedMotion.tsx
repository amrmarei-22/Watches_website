import { useEffect, useRef, useState } from 'react'
import { useGSAP } from '@gsap/react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { Product } from '../domain/types'
import { formatMoney } from '../domain/money'
import type { i18nLanguage } from '../lib/i18n'
import { getProductImageUrl } from '../features/catalog/imageUrl'
import { useReducedMotion } from './useReducedMotion'
import { getActiveIndex, shouldAnimate } from './featuredHelpers'
import { registerScrollTrigger } from './scrollScenes'

export function HomeFeaturedMotion({ products }: { products: Product[] }) {
  const { i18n, t } = useTranslation()
  const lang = i18n.language as i18nLanguage
  const reduced = useReducedMotion()
  const animate = typeof window !== 'undefined' && shouldAnimate({ reducedMotion: reduced, width: window.innerWidth })
  const scope = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0)
  const activeIndexRef = useRef(0)

  useGSAP(() => {
    if (!animate || !scope.current || products.length < 2) return
    const ScrollTrigger = registerScrollTrigger()
    const trigger = ScrollTrigger.create({
      trigger: scope.current,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: ({ progress }) => {
        const next = getActiveIndex(progress, products.length)
        if (next !== activeIndexRef.current) {
          activeIndexRef.current = next
          setActiveIndex(next)
        }
      },
    })
    const update = () => ScrollTrigger.update()
    window.addEventListener('lenis-scroll', update)
    const refresh = () => ScrollTrigger.refresh()
    window.addEventListener('load', refresh)
    document.fonts?.ready.then(refresh)
    return () => {
      window.removeEventListener('lenis-scroll', update)
      window.removeEventListener('load', refresh)
      trigger.kill()
    }
  }, { scope, dependencies: [animate, products.length, i18n.language] })

  useEffect(() => {
    const onResize = () => {
      if (!shouldAnimate({ reducedMotion: reduced, width: window.innerWidth })) setActiveIndex(0)
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [reduced])

  const scrollToIndex = (index: number) => {
    if (!animate || !scope.current) {
      setActiveIndex(index)
      activeIndexRef.current = index
      return
    }
    const start = scope.current.getBoundingClientRect().top + window.scrollY
    window.scrollTo({ top: start + index * window.innerHeight, behavior: reduced ? 'auto' : 'smooth' })
  }

  return (
    <div ref={scope} className={`featured-showcase ${animate ? 'is-animated' : 'is-fallback'}`} style={animate ? { minHeight: `${products.length * 100}svh` } : undefined}>
      <div className="featured-showcase-sticky">
        {products.map((product, index) => {
          const name = lang === 'ar' ? product.nameAr : product.nameEn
          const specs = [['movement', product.specs.movement], ['material', product.specs.material], ['caseSize', `${product.specs.caseSize} mm`]] as const
          const active = index === activeIndex
          const hidden = animate && !active
          return <article className={`featured-showcase-panel ${active ? 'is-active' : ''}`} key={product.id} aria-hidden={hidden}>
            <div className="featured-showcase-image"><img src={getProductImageUrl(product.images[0]?.path ?? '')} width="800" height="1000" loading={index === 0 ? 'eager' : 'lazy'} alt={name} /></div>
            <div className="featured-showcase-copy">
              <span className="product-brand">{product.brand}</span><h3>{name}</h3><strong className="product-price">{formatMoney(product.price, lang)}</strong>
              <div className="showcase-specs">{specs.map(([key, value]) => <span key={key}>{key === 'caseSize' ? `${t('catalog.caseSize')}: ${value}` : t(`specs.${key}.${value}`)}</span>)}</div>
              <Link className="ui-button ui-button-primary" tabIndex={hidden ? -1 : 0} to={`/${lang}/products/${product.id}`}>{t('cta.viewWatch')}</Link>
            </div>
          </article>
        })}
        <div className="showcase-controls" aria-label={t('chrome.home.featured')}>
          <button type="button" className="showcase-arrow" aria-label={t('cta.previous')} onClick={() => scrollToIndex(Math.max(0, activeIndex - 1))}><ChevronLeft aria-hidden="true" /></button>
          <span>{t('chrome.home.sceneCounter', { current: String(activeIndex + 1).padStart(2, '0'), total: String(products.length).padStart(2, '0') })}</span>
          <div className="showcase-dots">{products.map((product, index) => <button type="button" key={product.id} aria-label={`${index + 1}`} aria-current={index === activeIndex ? 'step' : undefined} onClick={() => scrollToIndex(index)} />)}</div>
          <button type="button" className="showcase-arrow" aria-label={t('cta.next')} onClick={() => scrollToIndex(Math.min(products.length - 1, activeIndex + 1))}><ChevronRight aria-hidden="true" /></button>
        </div>
      </div>
    </div>
  )
}
