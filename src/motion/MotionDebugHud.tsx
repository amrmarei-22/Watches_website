import { useEffect, useState, type ReactElement } from 'react'

type MotionDebugState = {
  reducedMotion: boolean
  motionOk: boolean
  lenisActive: boolean
  scrollTriggers: number
  transformedAncestors: string[]
  showcaseHeight: number
}

const initialState: MotionDebugState = {
  reducedMotion: false, motionOk: false, lenisActive: false, scrollTriggers: 0, transformedAncestors: [], showcaseHeight: 0,
}

export function MotionDebugHud({ showcase }: { showcase: HTMLElement | null }): ReactElement | null {
  const [state, setState] = useState(initialState)
  const enabled = import.meta.env.DEV && new URLSearchParams(window.location.search).get('motionDebug') === '1'
  useEffect(() => {
    if (!enabled) return
    let disposed = false
    const read = async () => {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const ancestors: string[] = []
      let current = document.querySelector<HTMLElement>('.featured-showcase') ?? showcase
      const measuredShowcase = current
      while (current) {
        const style = getComputedStyle(current)
        if (style.transform !== 'none' || style.filter !== 'none' || style.willChange !== 'auto' || style.overflow !== 'visible') ancestors.push(`${current.tagName.toLowerCase()}.${current.className}`)
        current = current.parentElement
      }
      let scrollTriggers = 0
      try {
        const { registerScrollTrigger } = await import('./scrollScenes')
        scrollTriggers = registerScrollTrigger().getAll().length
      } catch {
        scrollTriggers = 0
      }
      if (!disposed) setState({
        reducedMotion,
        motionOk: document.documentElement.classList.contains('motion-ok'),
        lenisActive: document.documentElement.dataset.lenisActive === 'true',
        scrollTriggers,
        transformedAncestors: ancestors,
        showcaseHeight: measuredShowcase?.getBoundingClientRect().height ?? 0,
      })
    }
    void read()
    const interval = window.setInterval(() => void read(), 500)
    return () => { disposed = true; window.clearInterval(interval) }
  }, [enabled, showcase])
  if (!enabled) return null
  return <aside className="motion-debug-hud" aria-live="polite">
    <strong>motionDebug=1</strong>
    <span>reduced-motion: {String(state.reducedMotion)}</span>
    <span>html.motion-ok: {String(state.motionOk)}</span>
    <span>Lenis active: {String(state.lenisActive)}</span>
    <span>ScrollTrigger live: {state.scrollTriggers}</span>
    <span>showcase height: {Math.round(state.showcaseHeight)}px</span>
    <span>blocking ancestors: {state.transformedAncestors.length ? state.transformedAncestors.join(', ') : 'none'}</span>
  </aside>
}
