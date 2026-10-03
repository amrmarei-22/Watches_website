import type { ReactNode } from 'react'
import { Button } from './Button'

export function EmptyState({ message, action, onAction, icon = '○' }: { message: string; action: string; onAction?: () => void; icon?: ReactNode }) {
  return <section className="ui-state" aria-live="polite"><span className="ui-state-icon" aria-hidden="true">{icon}</span><p>{message}</p>{onAction && <Button onClick={onAction}>{action}</Button>}</section>
}
