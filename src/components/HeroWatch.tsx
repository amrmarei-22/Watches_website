import { useEffect, useId, useRef, type PointerEvent, type RefObject } from 'react'
import { getCairoHandAngles, type WatchHandAngles } from './heroWatchTime'
import './HeroWatch.css'

const tickIndices = Array.from({ length: 60 }, (_, index) => index)
const hourIndices = Array.from({ length: 12 }, (_, index) => index)

function setHandAngles(
  refs: {
    hour: RefObject<SVGGElement | null>
    minute: RefObject<SVGGElement | null>
    second: RefObject<SVGGElement | null>
  },
  angles: WatchHandAngles,
) {
  if (refs.hour.current) refs.hour.current.style.transform = `rotate(${angles.hour}deg)`
  if (refs.minute.current) refs.minute.current.style.transform = `rotate(${angles.minute}deg)`
  if (refs.second.current) refs.second.current.style.transform = `rotate(${angles.second}deg)`
}

export function HeroWatch() {
  const id = useId().replace(/:/g, '')
  const hourHandRef = useRef<SVGGElement>(null)
  const minuteHandRef = useRef<SVGGElement>(null)
  const secondHandRef = useRef<SVGGElement>(null)
  useEffect(() => {
    const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    let reducedMotion = reducedMotionQuery.matches
    let stopped = false
    let entering = false
    let rafId = 0
    let entranceRafId = 0
    let refreshTimer = 0
    let entranceTimer = 0
    const handRefs = {
      hour: hourHandRef,
      minute: minuteHandRef,
      second: secondHandRef,
    }
    const handElements = [hourHandRef.current, minuteHandRef.current, secondHandRef.current]

    const cancelTimeUpdates = () => {
      window.cancelAnimationFrame(rafId)
      window.clearTimeout(refreshTimer)
    }

    const cancelEntrance = () => {
      window.cancelAnimationFrame(entranceRafId)
      window.clearTimeout(entranceTimer)
    }

    const updateHands = () => {
      const timestamp = Date.now()
      const adjustedTimestamp = reducedMotion
        ? Math.floor(timestamp / 1000) * 1000
        : timestamp
      setHandAngles(handRefs, getCairoHandAngles(adjustedTimestamp))
    }

    const scheduleUpdate = () => {
      if (stopped || entering || document.hidden) return
      if (reducedMotion) {
        updateHands()
        refreshTimer = window.setTimeout(scheduleUpdate, 1000)
        return
      }

      rafId = window.requestAnimationFrame(() => {
        updateHands()
        scheduleUpdate()
      })
    }

    const onVisibilityChange = () => {
      cancelTimeUpdates()
      if (!document.hidden) scheduleUpdate()
    }

    const onReducedMotionChange = (event: MediaQueryListEvent) => {
      reducedMotion = event.matches
      cancelTimeUpdates()
      cancelEntrance()
      entering = false
      handElements.forEach((hand) => {
        hand?.classList.remove('is-settling')
      })
      if (!document.hidden) {
        updateHands()
        scheduleUpdate()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    reducedMotionQuery.addEventListener('change', onReducedMotionChange)

    if (reducedMotion) {
      updateHands()
      scheduleUpdate()
    } else {
      entering = true
      const initialAngles = getCairoHandAngles(Date.now())
      setHandAngles(handRefs, {
        hour: initialAngles.hour - 2,
        minute: initialAngles.minute - 4,
        second: initialAngles.second - 4,
      })
      entranceRafId = window.requestAnimationFrame(() => {
        handElements.forEach((hand) => {
          hand?.classList.add('is-settling')
        })
        entranceRafId = window.requestAnimationFrame(() => {
          updateHands()
          entranceTimer = window.setTimeout(() => {
            if (stopped) return
            handElements.forEach((hand) => {
              hand?.classList.remove('is-settling')
            })
            entering = false
            scheduleUpdate()
          }, 1350)
        })
      })
    }

    return () => {
      stopped = true
      cancelTimeUpdates()
      cancelEntrance()
      document.removeEventListener('visibilitychange', onVisibilityChange)
      reducedMotionQuery.removeEventListener('change', onReducedMotionChange)
      handElements.forEach((hand) => {
        hand?.classList.remove('is-settling')
      })
    }
  }, [])

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (
      event.pointerType === 'touch' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !window.matchMedia('(hover: hover) and (pointer: fine)').matches
    ) return

    const bounds = event.currentTarget.getBoundingClientRect()
    const x = (event.clientX - bounds.left) / bounds.width - 0.5
    const y = (event.clientY - bounds.top) / bounds.height - 0.5
    event.currentTarget.style.setProperty('--tilt-x', `${x * 4}deg`)
    event.currentTarget.style.setProperty('--tilt-y', `${y * -4}deg`)
  }

  const resetPointerTilt = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.style.setProperty('--tilt-x', '0deg')
    event.currentTarget.style.setProperty('--tilt-y', '0deg')
  }

  const faceGradientId = `hero-watch-face-${id}`
  const bezelGradientId = `hero-watch-bezel-${id}`
  const glassGradientId = `hero-watch-glass-${id}`
  const glassClipId = `hero-watch-clip-${id}`
  const handShadowId = `hero-watch-shadow-${id}`

  return (
    <figure className="hero-watch-float is-entering" role="presentation" aria-hidden="true">
      <div
        className="hero-watch-tilt"
        onPointerMove={handlePointerMove}
        onPointerLeave={resetPointerTilt}
      >
        <svg className="hero-watch" viewBox="0 0 560 560" role="presentation" aria-hidden="true">
          <defs>
            <radialGradient id={faceGradientId}>
              <stop stopColor="var(--surface-2)" />
              <stop offset="1" stopColor="var(--bg)" />
            </radialGradient>
            <linearGradient id={bezelGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop stopColor="var(--accent)" />
              <stop offset=".28" stopColor="#f1dfb6" />
              <stop offset=".52" stopColor="var(--accent)" />
              <stop offset=".76" stopColor="#8e7444" />
              <stop offset="1" stopColor="var(--accent)" />
            </linearGradient>
            <linearGradient id={glassGradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop stopColor="white" stopOpacity="0" />
              <stop offset=".48" stopColor="white" stopOpacity=".22" />
              <stop offset=".56" stopColor="white" stopOpacity=".04" />
              <stop offset="1" stopColor="white" stopOpacity="0" />
            </linearGradient>
            <clipPath id={glassClipId}><circle cx="280" cy="280" r="215" /></clipPath>
            <filter id={handShadowId} x="-.5" y="-.5" width="2" height="2">
              <feDropShadow dx="0" dy="2" stdDeviation="2" floodOpacity=".42" />
            </filter>
          </defs>

          <circle className="hero-watch-glow" cx="280" cy="280" r="208" />
          <g className="hero-watch-bezel">
            <circle cx="280" cy="280" r="238" fill={`url(#${bezelGradientId})`} />
            <circle cx="280" cy="280" r="229" fill="none" stroke="var(--accent-contrast)" strokeOpacity=".3" strokeWidth="2" />
            <circle cx="280" cy="280" r="220" fill="none" stroke="var(--accent)" strokeWidth="3" />
            <circle cx="280" cy="280" r="214" fill={`url(#${faceGradientId})`} stroke="var(--border)" strokeWidth="2" />
          </g>

          <g className="hero-watch-crown">
            <rect x="512" y="263" width="31" height="34" rx="8" />
            <path d="M518 268v24M524 266v28M530 266v28M536 268v24" />
          </g>

          <g className="hero-watch-ticks">
            {tickIndices.map((index) => (
              <g key={index} transform={`rotate(${index * 6} 280 280)`}>
                <rect
                  className="hero-watch-tick"
                  x="279"
                  y="67"
                  width="2"
                  height={index % 5 === 0 ? 14 : 9}
                  rx="1"
                  style={{ animationDelay: `${index * 12}ms` }}
                />
              </g>
            ))}
          </g>

          <g className="hero-watch-hour-markers">
            {hourIndices.map((index) => (
              <g key={index} transform={`rotate(${index * 30} 280 280)`}>
                <path d="M280 91l4 15h-8z" />
                <path d="M280 94v8" className="hero-watch-marker-highlight" />
              </g>
            ))}
          </g>

          <g className="hero-watch-dial-copy">
            <text x="280" y="157" textAnchor="middle">VINTAGE</text>
            <text x="280" y="390" textAnchor="middle" className="hero-watch-automatic">AUTOMATIC</text>
          </g>

          <g ref={hourHandRef} className="hero-watch-hand hero-watch-hour-hand" style={{ transform: 'rotate(0deg)' }} filter={`url(#${handShadowId})`}>
            <path d="M280 280l-8-9 4-77q4-12 8 0l4 77z" />
            <path d="M280 205v65" className="hero-watch-hand-inlay" />
          </g>
          <g ref={minuteHandRef} className="hero-watch-hand hero-watch-minute-hand" style={{ transform: 'rotate(0deg)' }} filter={`url(#${handShadowId})`}>
            <path d="M280 280l-6-8 3-99q3-13 6 0l3 99z" />
            <path d="M280 179v91" className="hero-watch-hand-inlay" />
          </g>
          <g ref={secondHandRef} className="hero-watch-hand hero-watch-second-hand" style={{ transform: 'rotate(0deg)' }}>
            <path d="M278.5 281 279 134h2l.5 147-1.5 34z" />
            <circle cx="280" cy="308" r="7" />
          </g>

          <g className="hero-watch-glass" clipPath={`url(#${glassClipId})`}>
            <path className="hero-watch-glint" d="M115 58h95l235 445h-95z" fill={`url(#${glassGradientId})`} />
          </g>
          <circle className="hero-watch-center-ring" cx="280" cy="280" r="12" />
          <circle className="hero-watch-center-cap" cx="280" cy="280" r="6" />
        </svg>
      </div>
    </figure>
  )
}
