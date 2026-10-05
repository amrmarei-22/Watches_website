import { useEffect, useState } from 'react'

const query = '(prefers-reduced-motion: reduce)'

export function getReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia(query).matches
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(getReducedMotion)

  useEffect(() => {
    const media = window.matchMedia(query)
    const updateDocumentClass = () => {
      document.documentElement.classList.toggle('motion-ok', !media.matches)
    }
    const update = () => setReduced(media.matches)
    update()
    updateDocumentClass()
    media.addEventListener('change', update)
    media.addEventListener('change', updateDocumentClass)
    return () => {
      media.removeEventListener('change', update)
      media.removeEventListener('change', updateDocumentClass)
      document.documentElement.classList.remove('motion-ok')
    }
  }, [])

  return reduced
}
