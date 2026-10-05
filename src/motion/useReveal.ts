import { useEffect, useRef } from 'react'
import { useReducedMotion } from './useReducedMotion'

export function useReveal<T extends HTMLElement>(): React.RefObject<T | null> {
  const ref = useRef<T>(null)
  const reduced = useReducedMotion()
  useEffect(() => {
    const element = ref.current
    if (!element || reduced) return
    element.dataset.revealed = 'false'
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        element.dataset.revealed = 'true'
        observer.disconnect()
      }
    }, { threshold: 0.12 })
    observer.observe(element)
    return () => {
      observer.disconnect()
      delete element.dataset.revealed
    }
  }, [reduced])
  return ref
}
