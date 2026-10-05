const ENTRANCE_KEY = 'vintage-home-entrance-seen'

export function shouldRunEntrance(storage: Storage | null | undefined): boolean {
  if (!storage) return false
  try {
    return storage.getItem(ENTRANCE_KEY) !== '1'
  } catch {
    return false
  }
}

export function markEntranceSeen(storage: Storage | null | undefined): void {
  if (!storage) return
  try {
    storage.setItem(ENTRANCE_KEY, '1')
  } catch {
    // A blocked session store should not block the Home page.
  }
}
