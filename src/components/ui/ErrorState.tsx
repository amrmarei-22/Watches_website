import { Button } from './Button'

export function ErrorState({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return <section className="ui-state ui-error-state" role="alert"><p>{message}</p><Button variant="secondary" onClick={onAction}>{action}</Button></section>
}
