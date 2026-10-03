import { useEffect, useRef, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

export function Dialog({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? [])
    focusables()[0]?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => { document.removeEventListener('keydown', onKeyDown); previous?.focus() }
  }, [open, onClose])
  if (!open) return null
  return <div className="ui-dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div className="ui-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title" ref={ref}><div className="ui-dialog-header"><h2 id="dialog-title">{title}</h2><button className="ui-close" onClick={onClose} aria-label={t('ui.close')}>×</button></div>{children}</div></div>
}
