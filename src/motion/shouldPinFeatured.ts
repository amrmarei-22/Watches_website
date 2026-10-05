export function shouldPinFeatured(width: number, reducedMotion: boolean): boolean {
  return width >= 1024 && !reducedMotion
}
