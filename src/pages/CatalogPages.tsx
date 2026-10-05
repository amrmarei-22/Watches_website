import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Button } from '../components/ui/Button'
import { EmptyState } from '../components/ui/EmptyState'
import { ErrorState } from '../components/ui/ErrorState'
import { Skeleton } from '../components/ui/Skeleton'
import { getAvailability, maxQuantity } from '../domain/inventory'
import { formatMoney } from '../domain/money'
import type { Product } from '../domain/types'
import { useCart } from '../hooks/useCart'
import { useCatalogProducts } from '../features/catalog/catalogQuery'
import { getProductImageUrl } from '../features/catalog/imageUrl'
import { emptyCatalogFilters, filterAndSearchProducts, getAvailabilityLabel, paginateProducts, sortProducts, type CatalogFilters, type CatalogSort } from '../features/catalog/catalogLogic'
import { PAGE_SIZE } from '../config/businessConfig'
import type { i18nLanguage } from '../lib/i18n'
import { useReveal } from '../motion/useReveal'
import { useDirection } from '../motion/useDirection'
import { useReducedMotion } from '../motion/useReducedMotion'
import { stagger } from '../motion/presets'
import { lazy, Suspense } from 'react'
import { getBrands, getFeaturedProducts, getLatestProductByGender, getNewArrivals, homeGenders } from '../features/catalog/homeLogic'
import { HeroDial } from '../components/HeroDial'
import { MotionDebugHud } from '../motion/MotionDebugHud'
import { markEntranceSeen, shouldRunEntrance } from '../motion/entrance'
import { shouldAnimate } from '../motion/featuredHelpers'

const HomeFeaturedMotion = lazy(() => import('../motion/HomeFeaturedMotion').then((module) => ({ default: module.HomeFeaturedMotion })))

function usePageTitle(title: string) {
  useEffect(() => { document.title = title }, [title])
}

function ProductImage({ product, index, eager = false }: { product: Product; index: number; eager?: boolean }) {
  const { i18n } = useTranslation()
  const image = product.images[index]
  return image ? <img src={getProductImageUrl(image.path)} width="800" height="1000" loading={eager ? 'eager' : 'lazy'} alt={i18n.language === 'ar' ? product.nameAr : product.nameEn} /> : <div className="product-image-placeholder" aria-hidden="true" />
}

function AvailabilityBadge({ product }: { product: Product }) {
  const { t } = useTranslation()
  const availability = getAvailability(product)
  if (availability === 'IN_STOCK') return null
  const label = getAvailabilityLabel(availability, product.stock)
  return <span className={`availability-badge availability-${availability.toLowerCase()}`}>{t(label.key, label.count === undefined ? undefined : { n: label.count })}</span>
}

export function ProductCard({ product }: { product: Product }) {
  const { i18n, t } = useTranslation()
  const lang = i18n.language as i18nLanguage
  const name = lang === 'ar' ? product.nameAr : product.nameEn
  const reveal = useReveal<HTMLAnchorElement>()
  return <Link ref={reveal} className="product-card motion-reveal" style={stagger(0)} to={`/${lang}/products/${product.id}`}>
    <div className="product-card-image"><ProductImage product={product} index={0} /><ProductImage product={product} index={1} /><AvailabilityBadge product={product} /></div>
    <div className="product-card-copy"><span className="product-brand">{product.brand}</span><h2>{name}</h2><strong>{formatMoney(product.price, lang)}</strong><span className="sr-only">{t('pages.productDetails')}</span></div>
  </Link>
}

function readFilters(params: URLSearchParams): CatalogFilters {
  const read = (key: string) => params.getAll(key)
  const min = params.get('min')
  const max = params.get('max')
  return { brands: read('brand'), minPrice: min ? Number(min) : undefined, maxPrice: max ? Number(max) : undefined, inStockOnly: params.get('stock') === '1', genders: read('gender'), movements: read('movement'), materials: read('material') }
}

function updateParams(params: URLSearchParams, changes: Record<string, string | string[] | undefined>) {
  Object.entries(changes).forEach(([key, value]) => {
    params.delete(key)
    if (Array.isArray(value)) value.forEach((item) => params.append(key, item))
    else if (value !== undefined && value !== '') params.set(key, value)
  })
  params.set('page', '1')
  return params
}

function FilterControls({ products, filters, onChange }: { products: Product[]; filters: CatalogFilters; onChange: (next: CatalogFilters) => void }) {
  const { t } = useTranslation()
  const brands = [...new Set(products.map((product) => product.brand))].sort()
  const choices = (key: 'gender' | 'movement' | 'material') => [...new Set(products.map((product) => product.specs[key]))]
  const toggle = (key: 'brands' | 'genders' | 'movements' | 'materials', value: string) => onChange({ ...filters, [key]: filters[key].includes(value) ? filters[key].filter((item) => item !== value) : [...filters[key], value] })
  return <div className="filter-controls">
    <fieldset><legend>{t('catalog.brand')}</legend>{brands.map((brand) => <label className="filter-option" key={brand}><input type="checkbox" checked={filters.brands.includes(brand)} onChange={() => toggle('brands', brand)} /><span>{brand}</span></label>)}</fieldset>
    <fieldset><legend>{t('catalog.gender')}</legend>{choices('gender').map((value) => <label className="filter-option" key={value}><input type="checkbox" checked={filters.genders.includes(value)} onChange={() => toggle('genders', value)} /><span>{t(`specs.gender.${value}`)}</span></label>)}</fieldset>
    <fieldset><legend>{t('catalog.movement')}</legend>{choices('movement').map((value) => <label className="filter-option" key={value}><input type="checkbox" checked={filters.movements.includes(value)} onChange={() => toggle('movements', value)} /><span>{t(`specs.movement.${value}`)}</span></label>)}</fieldset>
    <fieldset><legend>{t('catalog.material')}</legend>{choices('material').map((value) => <label className="filter-option" key={value}><input type="checkbox" checked={filters.materials.includes(value)} onChange={() => toggle('materials', value)} /><span>{t(`specs.material.${value}`)}</span></label>)}</fieldset>
    <fieldset><legend>{t('catalog.priceRange')}</legend><label>{t('catalog.minimum')}<input type="number" min="0" value={filters.minPrice === undefined ? '' : filters.minPrice / 100} onChange={(event) => onChange({ ...filters, minPrice: event.target.value ? Number(event.target.value) * 100 : undefined })} /></label><label>{t('catalog.maximum')}<input type="number" min="0" value={filters.maxPrice === undefined ? '' : filters.maxPrice / 100} onChange={(event) => onChange({ ...filters, maxPrice: event.target.value ? Number(event.target.value) * 100 : undefined })} /></label></fieldset>
    <label className="filter-option filter-toggle"><input type="checkbox" checked={filters.inStockOnly} onChange={(event) => onChange({ ...filters, inStockOnly: event.target.checked })} /><span>{t('catalog.inStockOnly')}</span></label>
  </div>
}

export function ListingPage() {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useCatalogProducts()
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)
  const lang = i18n.language as i18nLanguage
  usePageTitle(t('pages.listing'))
  const query = params.get('q') ?? ''
  const filters = readFilters(params)
  const sort = (params.get('sort') as CatalogSort | null) ?? 'newest'
  const page = Number(params.get('page') ?? '1')
  const filtered = useMemo(() => data ? sortProducts(filterAndSearchProducts(data, query, filters, lang), sort, lang) : [], [data, filters, lang, query, sort])
  const paginated = paginateProducts(filtered, page, PAGE_SIZE)
  const setFilters = (next: CatalogFilters) => setParams(updateParams(new URLSearchParams(params), { brand: next.brands, min: next.minPrice?.toString(), max: next.maxPrice?.toString(), stock: next.inStockOnly ? '1' : undefined, gender: next.genders, movement: next.movements, material: next.materials }))
  const clear = () => setParams(new URLSearchParams({ page: '1' }))
  if (isLoading) return <section className="container catalog-page"><Skeleton className="listing-skeleton" /><Skeleton className="listing-skeleton" /></section>
  if (isError || !data) return <ErrorState message={t('messages.LISTING_ERROR')} action={t('actions.tryAgain')} onAction={() => void refetch()} />
  return <section className="container catalog-page" key={`${query}-${sort}-${page}-${JSON.stringify(filters)}`}>
    <div className="catalog-header"><div><h1 className="page-heading">{t('pages.listing')}</h1><p>{t('catalog.resultCount', { count: filtered.length })}</p></div><button className="filter-drawer-button" onClick={() => setMobileFiltersOpen(true)}>{t('catalog.filters')}</button></div>
    <div className="catalog-toolbar"><label className="search-field"><span className="sr-only">{t('catalog.search')}</span><input value={query} onChange={(event) => setParams(updateParams(new URLSearchParams(params), { q: event.target.value }))} placeholder={t('catalog.search')} /></label><label>{t('catalog.sort')}<select value={sort} onChange={(event) => setParams(updateParams(new URLSearchParams(params), { sort: event.target.value }))}><option value="newest">{t('catalog.newest')}</option><option value="price-asc">{t('catalog.priceAsc')}</option><option value="price-desc">{t('catalog.priceDesc')}</option><option value="name">{t('catalog.name')}</option></select></label></div>
    <div className="catalog-layout"><aside><FilterControls products={data} filters={filters} onChange={setFilters} /></aside><div className="catalog-results">
      <div className="filter-chips">{[...filters.brands, ...filters.genders, ...filters.movements, ...filters.materials].map((chip) => <button key={chip} onClick={() => setFilters({ ...filters, brands: filters.brands.filter((item) => item !== chip), genders: filters.genders.filter((item) => item !== chip), movements: filters.movements.filter((item) => item !== chip), materials: filters.materials.filter((item) => item !== chip) })}>{chip} ×</button>)}{filters.minPrice !== undefined && <button onClick={() => setFilters({ ...filters, minPrice: undefined })}>{t('catalog.minimum')}: {formatMoney(filters.minPrice, lang)} ×</button>}{filters.maxPrice !== undefined && <button onClick={() => setFilters({ ...filters, maxPrice: undefined })}>{t('catalog.maximum')}: {formatMoney(filters.maxPrice, lang)} ×</button>}{filters.inStockOnly && <button onClick={() => setFilters({ ...filters, inStockOnly: false })}>{t('catalog.inStockOnly')} ×</button>}</div>
      {paginated.items.length === 0 ? <EmptyState message={t('messages.LISTING_EMPTY')} action={t('actions.clearFilters')} onAction={clear} /> : <div className="product-grid">{paginated.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>}
      {paginated.pageCount > 1 && <nav className="pagination" aria-label={t('catalog.pagination')}>{Array.from({ length: paginated.pageCount }, (_, index) => index + 1).map((value) => <button key={value} aria-current={value === paginated.page ? 'page' : undefined} onClick={() => setParams(new URLSearchParams(updateParams(new URLSearchParams(params), { page: value.toString() })))}>{value}</button>)}</nav>}
    </div></div>
    {mobileFiltersOpen && <div className="filter-drawer"><div className="filter-drawer-header"><h2>{t('catalog.filters')}</h2><button onClick={() => setMobileFiltersOpen(false)}>{t('ui.close')}</button></div><FilterControls products={data} filters={filters} onChange={setFilters} /></div>}
  </section>
}

export function ProductPage() {
  const { t, i18n } = useTranslation()
  const { id } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError } = useCatalogProducts()
  const { addItem, items: cartItems } = useCart()
  const [quantity, setQuantity] = useState(1)
  const [added, setAdded] = useState(false)
  const lang = i18n.language as i18nLanguage
  const product = data?.find((item) => item.id === id)
  usePageTitle(product ? (lang === 'ar' ? product.nameAr : product.nameEn) : t('pages.productDetails'))
  if (isLoading) return <section className="container product-page"><Skeleton className="product-skeleton" /></section>
  if (isError || !product) return <EmptyState message={t('messages.PAGE_404')} action={t('actions.goHome')} onAction={() => window.location.assign(`/${lang}`)} />
  const availability = getAvailability(product)
  const max = maxQuantity(product)
  const alreadyInCart = cartItems.find((item) => item.product.id === product.id)?.quantity ?? 0
  const availableToAdd = Math.max(0, max - alreadyInCart)
  const name = lang === 'ar' ? product.nameAr : product.nameEn
  const description = lang === 'ar' ? product.descriptionAr || product.descriptionEn : product.descriptionEn || product.descriptionAr
  const add = async () => { try { await addItem(product, quantity); setAdded(true) } catch { setAdded(false) } }
  return <section className="container product-page"><button type="button" className="product-back-link" onClick={() => { if (window.history.length > 1) navigate(-1); else navigate(`/${lang}`) }}><span aria-hidden="true">←</span> {t('actions.back')}</button><div className="product-gallery">{product.images.map((image, index) => <img key={image.id} src={getProductImageUrl(image.path)} width="800" height="1000" loading={index === 0 ? 'eager' : 'lazy'} alt={name} />)}</div><div className="product-info motion-reveal"><span className="product-brand">{product.brand}</span><h1 className="page-heading">{name}</h1><strong className="product-price">{formatMoney(product.price, lang)}</strong><AvailabilityBadge product={product} /><dl className="product-specs">{Object.entries(product.specs).map(([key, value]) => <div key={key}><dt>{key === 'caseSize' ? t('catalog.caseSize') : key === 'waterResistance' ? t('catalog.waterResistance') : t(`specs.${key}.${value}`)}</dt><dd>{key === 'caseSize' ? `${value} mm` : key === 'waterResistance' ? `${value} m` : t(`specs.${key}.${value}`)}</dd></div>)}</dl><p>{description}</p><label className="quantity-control">{t('catalog.quantity')}<select value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} disabled={availability === 'OUT_OF_STOCK' || availableToAdd === 0}>{Array.from({ length: availableToAdd }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}</option>)}</select></label><Button disabled={availability === 'OUT_OF_STOCK' || availableToAdd === 0} onClick={() => void add()}>{added ? '✓' : availability === 'OUT_OF_STOCK' ? t('messages.PRODUCT_OUT_OF_STOCK') : t('catalog.addToCart')}</Button>{added && <p className="sr-only" aria-live="polite">{t('messages.CART_ADDED')}</p>}</div><div className="mobile-add-bar"><Button disabled={availability === 'OUT_OF_STOCK' || availableToAdd === 0} onClick={() => void add()}>{added ? '✓' : availability === 'OUT_OF_STOCK' ? t('messages.PRODUCT_OUT_OF_STOCK') : t('catalog.addToCart')}</Button></div></section>
}

export function HomePage() {
  const { t, i18n } = useTranslation()
  const { data, isLoading, isError, refetch } = useCatalogProducts()
  const lang = i18n.language as i18nLanguage
  const direction = useDirection()
  const reduced = useReducedMotion()
  const showcaseRef = useRef<HTMLDivElement>(null)
  const [showScrollCue, setShowScrollCue] = useState(true)
  usePageTitle(t('pages.home'))
  useEffect(() => {
    const onScroll = () => setShowScrollCue(window.scrollY <= 80)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (!data || reduced || !shouldAnimate({ reducedMotion: reduced, width: window.innerWidth })) return
    let storage: Storage | null = null
    try { storage = window.sessionStorage } catch { return }
    if (!shouldRunEntrance(storage)) return
    markEntranceSeen(storage)
    let cancelled = false
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return
      gsap.fromTo('.home-entrance-item', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.08, clearProps: 'transform,opacity' })
    })
    return () => { cancelled = true }
  }, [data, reduced])
  useEffect(() => {
    if (!data || reduced) return
    let cancelled = false
    let cleanup: (() => void) | undefined
    void import('gsap').then(({ gsap }) => {
      if (cancelled) return
      const hero = document.querySelector<HTMLElement>('.home-hero')
      if (!hero) return
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      timeline
        .fromTo(hero.querySelector('.hero-copy h1'), { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: 0.7 })
        .fromTo(hero.querySelector('.hero-copy p'), { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.42')
        .fromTo(hero.querySelector('.hero-copy .ui-button'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.55 }, '-=0.32')
      const watch = hero.querySelector<HTMLElement>('.home-hero-watch, .hero-dial')
      if (watch) gsap.to(watch, { y: -8, duration: 3.8, ease: 'sine.inOut', repeat: -1, yoyo: true })
      cleanup = () => {
        timeline.kill()
        if (watch) gsap.killTweensOf(watch)
      }
    })
    return () => { cancelled = true; cleanup?.() }
  }, [data, reduced])
  useEffect(() => {
    const image = data?.find((product) => product.featured)?.images[0]
    if (!image) return
    const preload = document.createElement('link')
    preload.rel = 'preload'; preload.as = 'image'; preload.href = getProductImageUrl(image.path)
    document.head.appendChild(preload)
    return () => preload.remove()
  }, [data])
  if (isLoading) return <section className="container home-page"><Skeleton className="home-skeleton" /></section>
  if (isError || !data) return <ErrorState message={t('messages.LISTING_ERROR')} action={t('actions.tryAgain')} onAction={() => void refetch()} />
  const featured = getFeaturedProducts(data)
  const heroPath = featured[0]?.images[0]?.path
  const newArrivals = getNewArrivals(data)
  const brands = getBrands(data)
  const genderTiles = homeGenders.map((gender) => ({ gender, product: getLatestProductByGender(data, gender) })).filter((item): item is { gender: typeof item.gender; product: Product } => item.product !== undefined)
  const heroVisual = !heroPath || heroPath.startsWith('/placeholders/') ? <HeroDial /> : <img className="home-hero-watch" src={getProductImageUrl(heroPath)} width="800" height="1000" loading="eager" alt={featured[0] ? (lang === 'ar' ? featured[0].nameAr : featured[0].nameEn) : t('home.heroVisualAlt')} />
  return <section className="home-page">
    <div className="container home-hero motion-reveal" data-direction={direction} data-reduced={reduced}><div className="hero-copy"><h1 className="page-heading"><span className="hero-headline-mask"><span>{t('home.heroHeadline')}</span></span></h1><p>{t('home.heroSubtitle')}</p><Link className="ui-button ui-button-primary" to={`/${lang}/shop`}>{t('chrome.cta.shopWatches')}</Link></div><div className="hero-visual">{heroVisual}</div><span className={`scroll-cue ${showScrollCue ? '' : 'is-hidden'}`} aria-hidden="true">↓</span></div>
    {featured.length > 0 && <div className="container home-section home-entrance-item"><div className="section-heading"><h2>{t('chrome.home.featured')}</h2><Link to={`/${lang}/shop`}>{t('chrome.cta.viewAll')}</Link></div><Suspense fallback={<div className="product-grid">{featured.slice(0, 12).map((product) => <ProductCard key={product.id} product={product} />)}</div>}><div ref={showcaseRef}><HomeFeaturedMotion products={featured} /></div></Suspense><MotionDebugHud showcase={showcaseRef.current} /></div>}
    {genderTiles.length > 0 && <div className="container home-section"><div className="section-heading"><h2>{t('chrome.home.shopByGender')}</h2></div><div className="gender-tiles">{genderTiles.map(({ gender, product }) => <Link className="gender-tile" key={gender} to={`/${lang}/shop?gender=${gender}`}><img src={getProductImageUrl(product.images[0]?.path ?? '')} width="800" height="1000" loading="lazy" alt={t(`specs.gender.${gender}`)} /><span>{t(`specs.gender.${gender}`)}</span></Link>)}</div></div>}
    {newArrivals.length > 0 && <div className="container home-section"><div className="section-heading"><h2>{t('chrome.home.newArrivals')}</h2><Link to={`/${lang}/shop`}>{t('chrome.cta.viewAll')}</Link></div><div className="product-grid">{newArrivals.map((product) => <ProductCard key={product.id} product={product} />)}</div></div>}
    {brands.length > 0 && <div className="container home-section"><div className="section-heading"><h2>{t('chrome.home.ourBrands')}</h2></div><div className="brand-links">{brands.map((brandName) => <Link key={brandName} to={`/${lang}/shop?brand=${encodeURIComponent(brandName)}`}>{brandName}</Link>)}</div></div>}
  </section>
}
