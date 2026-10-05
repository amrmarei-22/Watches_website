import { useEffect, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { useReducedMotion } from './useReducedMotion'

export function SmoothScroll({ children }: { children: ReactNode }) {
  const reducedMotion = useReducedMotion()
  const location = useLocation()

  useEffect(() => {
    const isHome = /^\/(ar|en)\/?$/.test(location.pathname)
    if (!isHome || reducedMotion || window.matchMedia('(pointer: coarse)').matches) return
    let lenis: { raf: (time: number) => void; destroy: () => void; stop: () => void; start: () => void } | undefined
    let frame = 0
    let cancelled = false
    const isScrollPaused = () => Boolean(document.querySelector('[role="dialog"], .cart-drawer, .filter-drawer'))
    const onDialogChange = () => {
      const paused = isScrollPaused()
      if (paused) {
        document.documentElement.dataset.scrollLocked = 'true'
        lenis?.stop()
      } else {
        delete document.documentElement.dataset.scrollLocked
        lenis?.start()
      }
    }
    const observer = new MutationObserver(onDialogChange)
    observer.observe(document.body, { childList: true, subtree: true })
    void import('lenis').then(({ default: Lenis }) => {
      if (cancelled) return
      const instance = new Lenis()
      lenis = instance
      document.documentElement.dataset.lenisActive = 'true'
      onDialogChange()
      const raf = (time: number) => {
        instance.raf(time)
        window.dispatchEvent(new CustomEvent('lenis-scroll'))
        frame = requestAnimationFrame(raf)
      }
      frame = requestAnimationFrame(raf)
    })
    const onFocus = (event: FocusEvent) => {
      const target = event.target
      if (target instanceof HTMLElement) target.scrollIntoView({ block: 'nearest' })
    }
    document.addEventListener('focusin', onFocus)
    return () => {
      cancelled = true
      cancelAnimationFrame(frame)
      lenis?.destroy()
      delete document.documentElement.dataset.lenisActive
      observer.disconnect()
      document.removeEventListener('focusin', onFocus)
    }
  }, [reducedMotion, location.pathname])

  return <>{children}</>
}
