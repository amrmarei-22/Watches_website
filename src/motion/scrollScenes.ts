import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

let registered = false

export function registerScrollTrigger(): typeof ScrollTrigger {
  if (!registered) {
    gsap.registerPlugin(ScrollTrigger)
    registered = true
  }
  return ScrollTrigger
}

export function refreshScrollTrigger(): void {
  if (registered) ScrollTrigger.refresh()
}

export { gsap, ScrollTrigger }
