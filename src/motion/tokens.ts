export const motionTokens = {
  duration: {
    micro: 0.2,
    ui: 0.375,
    scene: 0.8,
  },
  easing: 'cubic-bezier(.22,1,.36,1)',
  cssEasing: 'cubic-bezier(.22,1,.36,1)',
  stagger: 0.07,
} as const

export const motionCssVars = {
  '--motion-duration-micro': `${motionTokens.duration.micro}s`,
  '--motion-duration-ui': `${motionTokens.duration.ui}s`,
  '--motion-duration-scene': `${motionTokens.duration.scene}s`,
  '--motion-easing': motionTokens.cssEasing,
} as const
