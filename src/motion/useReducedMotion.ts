import { useEffect, useState } from 'react'

const query = '(prefers-reduced-motion: reduce)'

export function getReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getReducedMotion)

  useEffect(() => {
    const media = window.matchMedia(query)
    const update = () => setReduced(media.matches)
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return reduced
}
