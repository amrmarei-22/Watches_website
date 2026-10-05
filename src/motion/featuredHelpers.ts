export function getActiveIndex(progress: number, count: number): number {
  if (count <= 1) return 0
  const clamped = Math.max(0, Math.min(1, progress))
  return Math.min(count - 1, Math.floor(clamped * count))
}

export function shouldAnimate({ reducedMotion, width }: { reducedMotion: boolean; width: number }): boolean {
  return !reducedMotion && width >= 1024
}
