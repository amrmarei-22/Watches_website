import { useLayoutEffect, useRef } from 'react'
import { useLocation, useNavigationType, type Location } from 'react-router-dom'

type ElementPosition = { left: number; top: number }
type ScrollPosition = ElementPosition & { containers: Record<string, ElementPosition> }
type ScrollPositions = Record<string, ScrollPosition>

const STORAGE_KEY = 'vintage_scroll_positions_v1'
const RESTORE_ATTEMPTS = 12

function readPositions(): ScrollPositions {
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY)
    if (!stored) return {}
    const parsed: unknown = JSON.parse(stored)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as ScrollPositions
      : {}
  } catch {
    return {}
  }
}

function getAnchor(hash: string): HTMLElement | null {
  if (!hash) return null
  try {
    return document.getElementById(decodeURIComponent(hash.slice(1)))
  } catch {
    return null
  }
}

function containerKey(element: HTMLElement, index: number): string {
  return element.dataset.scrollContainer || element.id || String(index)
}

export function ScrollManager() {
  const location = useLocation()
  const navigationType = useNavigationType()
  const positionsRef = useRef<ScrollPositions>(readPositions())
  const currentLocationRef = useRef<Location | null>(null)

  useLayoutEffect(() => {
    window.history.scrollRestoration = 'manual'
  }, [])

  useLayoutEffect(() => {
    const savePosition = (key: string, position: ScrollPosition) => {
      positionsRef.current[key] = position
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positionsRef.current))
      } catch {
        // Scroll restoration remains available for this app session.
      }
    }

    const readPosition = (key: string) => positionsRef.current[key]
    const capturePosition = (): ScrollPosition => {
      const containers = Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>('[data-scroll-container]')].map((element, index) => [
          containerKey(element, index),
          { left: element.scrollLeft, top: element.scrollTop },
        ]),
      )
      return { left: window.scrollX, top: window.scrollY, containers }
    }
    const applyPosition = (position: ScrollPosition) => {
      window.scrollTo({ left: position.left, top: position.top, behavior: 'instant' })
      document.querySelectorAll<HTMLElement>('[data-scroll-container]').forEach((element, index) => {
        const saved = position.containers[containerKey(element, index)]
        element.scrollLeft = saved?.left ?? 0
        element.scrollTop = saved?.top ?? 0
      })
    }
    const resetToTop = () => {
      window.scrollTo({ left: 0, top: 0, behavior: 'instant' })
      document.querySelectorAll<HTMLElement>('[data-scroll-container]').forEach((element) => {
        element.scrollLeft = 0
        element.scrollTop = 0
      })
    }
    const focusMain = () => {
      const target = document.querySelector<HTMLElement>('main h1') ?? document.getElementById('main-content')
      if (target) {
        if (!target.hasAttribute('tabindex')) target.tabIndex = -1
        target.focus({ preventScroll: true })
      }
    }
    const scrollToAnchor = (hash: string, attempt = 0) => {
      const target = getAnchor(hash)
      if (target) {
        target.scrollIntoView({ block: 'start', behavior: 'instant' })
        focusMain()
      } else if (attempt < RESTORE_ATTEMPTS) {
        window.requestAnimationFrame(() => scrollToAnchor(hash, attempt + 1))
      }
    }
    const restorePopPosition = (position: ScrollPosition, attempt = 0) => {
      applyPosition(position)
      if (window.scrollY < position.top && attempt < RESTORE_ATTEMPTS) {
        window.requestAnimationFrame(() => restorePopPosition(position, attempt + 1))
      } else {
        focusMain()
      }
    }

    const previous = currentLocationRef.current
    if (previous) savePosition(previous.key, capturePosition())
    currentLocationRef.current = location

    if (previous && previous.pathname === location.pathname) {
      const saved = readPosition(location.key)
      if (previous.hash !== location.hash) {
        if (navigationType === 'POP' && saved) applyPosition(saved)
        else if (location.hash) scrollToAnchor(location.hash)
      } else if (navigationType !== 'POP' || !saved) {
        savePosition(location.key, capturePosition())
      }
      return
    }

    if (!previous) {
      const saved = readPosition(location.key)
      if (location.hash) scrollToAnchor(location.hash)
      else if (navigationType === 'POP' && saved) restorePopPosition(saved)
      else resetToTop()
      return
    }

    if (navigationType === 'POP') {
      const saved = readPosition(location.key)
      if (saved) restorePopPosition(saved)
      else if (location.hash) scrollToAnchor(location.hash)
      else {
        resetToTop()
        focusMain()
      }
      return
    }

    if (location.hash) scrollToAnchor(location.hash)
    else resetToTop()
    focusMain()
  }, [location, navigationType])

  useLayoutEffect(() => {
    const onScroll = () => {
      const current = currentLocationRef.current
      if (!current) return
      const containers = Object.fromEntries(
        [...document.querySelectorAll<HTMLElement>('[data-scroll-container]')].map((element, index) => [
          containerKey(element, index),
          { left: element.scrollLeft, top: element.scrollTop },
        ]),
      )
      const position = { left: window.scrollX, top: window.scrollY, containers }
      positionsRef.current[current.key] = position
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(positionsRef.current))
      } catch {
        // Scroll restoration remains available for this app session.
      }
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return null
}
