import { useEffect, useState } from 'react'

export function getDirection(): 1 | -1 {
  return typeof document !== 'undefined' && document.documentElement.dir === 'rtl' ? -1 : 1
}

export function useDirection(): 1 | -1 {
  const [direction, setDirection] = useState<1 | -1>(getDirection)

  useEffect(() => {
    const element = document.documentElement
    const observer = new MutationObserver(() => setDirection(getDirection()))
    observer.observe(element, { attributes: true, attributeFilter: ['dir'] })
    setDirection(getDirection())
    return () => observer.disconnect()
  }, [])

  return direction
}
