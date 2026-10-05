import { useEffect, useState } from 'react'

export function HeroDial() {
  const [hands, setHands] = useState({ hour: 0, minute: 0, second: 0 })
  useEffect(() => {
    const now = new Date()
    setHands({
      hour: ((now.getHours() % 12) + now.getMinutes() / 60) * 30,
      minute: (now.getMinutes() + now.getSeconds() / 60) * 6,
      second: now.getSeconds() * 6,
    })
  }, [])

  return (
    <svg className="hero-dial" viewBox="0 0 560 560" role="img" aria-hidden="true">
      <defs>
        <radialGradient id="hero-dial-face"><stop stopColor="var(--surface-2)" /><stop offset="1" stopColor="var(--bg)" /></radialGradient>
        <linearGradient id="hero-dial-bezel"><stop stopColor="var(--accent)" /><stop offset=".5" stopColor="var(--surface-2)" /><stop offset="1" stopColor="var(--accent)" /></linearGradient>
        <filter id="hero-dial-glow"><feGaussianBlur stdDeviation="26" /></filter>
      </defs>
      <circle className="hero-dial-glow" cx="280" cy="280" r="220" filter="url(#hero-dial-glow)" />
      <circle cx="280" cy="280" r="238" fill="url(#hero-dial-bezel)" />
      <circle cx="280" cy="280" r="226" fill="none" stroke="var(--accent)" strokeWidth="3" />
      <circle cx="280" cy="280" r="216" fill="url(#hero-dial-face)" stroke="var(--border)" strokeWidth="2" />
      <g className="hero-dial-ticks">
        {Array.from({ length: 60 }, (_, index) => <line key={index} x1="280" y1="78" x2="280" y2={index % 5 === 0 ? 94 : 86} transform={`rotate(${index * 6} 280 280)`} />)}
      </g>
      <g className="hero-dial-markers">
        {Array.from({ length: 12 }, (_, index) => <rect key={index} x="276" y="94" width="8" height="24" rx="2" transform={`rotate(${index * 30} 280 280)`} />)}
      </g>
      <text x="280" y="218" textAnchor="middle">VINTAGE</text>
      <text x="280" y="350" textAnchor="middle" className="hero-dial-automatic">AUTOMATIC</text>
      <g className="hero-dial-hand hero-dial-hour" style={{ transform: `rotate(${hands.hour}deg)` }}><rect x="273" y="174" width="14" height="112" rx="7" /></g>
      <g className="hero-dial-hand hero-dial-minute" style={{ transform: `rotate(${hands.minute}deg)` }}><rect x="274" y="140" width="12" height="146" rx="6" /></g>
      <g className="hero-dial-second" style={{ transform: `rotate(${hands.second}deg)` }}><path d="M278 292V128h4v164h-4Z" /><circle cx="280" cy="310" r="12" /></g>
      <circle cx="280" cy="280" r="15" fill="var(--accent)" /><circle cx="280" cy="280" r="6" fill="var(--accent-contrast)" />
    </svg>
  )
}
