import type { CSSProperties } from 'react'
import { motionTokens } from './tokens'

export const fadeRise = (reduced: boolean, direction: 1 | -1 = 1): CSSProperties => ({
  opacity: reduced ? 1 : undefined,
  transform: reduced ? undefined : `translate3d(${direction * 0}px, 1.25rem, 0)`,
  transition: reduced ? 'none' : `opacity ${motionTokens.duration.scene}s ${motionTokens.cssEasing}, transform ${motionTokens.duration.scene}s ${motionTokens.cssEasing}`,
})

export const stagger = (index: number): CSSProperties => ({
  transitionDelay: `${Math.min(index, 11) * motionTokens.stagger}s`,
})

export const maskReveal: CSSProperties = {
  overflow: 'hidden',
  clipPath: 'inset(0 0 0 0)',
}
