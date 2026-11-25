import { useEffect, useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

export function Dialog({
  open,
  title,
  children,
  onClose,
  initialFocusRef,
  returnFocusRef,
  className,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  initialFocusRef?: RefObject<HTMLElement | null>
  returnFocusRef?: RefObject<HTMLElement | null>
  className?: string
}) {
  const { t } = useTranslation()
  const ref = useRef<HTMLDivElement>(null)
  const latestPropsRef = useRef({ onClose, initialFocusRef, returnFocusRef })
  const titleId = useId()
  useLayoutEffect(() => {
    latestPropsRef.current = { onClose, initialFocusRef, returnFocusRef }
  })

  useEffect(() => {
    if (!open) return
    const previous = latestPropsRef.current.returnFocusRef?.current
      ?? document.activeElement as HTMLElement | null
    const root = document.documentElement
    const previousScrollLock = root.getAttribute('data-scroll-locked')
    root.dataset.scrollLocked = 'true'
    const focusables = () => Array.from(ref.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? [])
    const initialFocus = latestPropsRef.current.initialFocusRef?.current ?? focusables()[0]
    initialFocus?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        latestPropsRef.current.onClose()
      }
      if (event.key !== 'Tab') return
      const items = focusables()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (!ref.current?.contains(document.activeElement)) {
        event.preventDefault()
        ;(event.shiftKey ? last : first).focus()
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousScrollLock === null) delete root.dataset.scrollLocked
      else root.setAttribute('data-scroll-locked', previousScrollLock)
      previous?.focus()
    }
  }, [open])

  if (!open) return null
  return (
    <div
      className="ui-dialog-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) latestPropsRef.current.onClose()
      }}
    >
      <div
        className={`ui-dialog${className ? ` ${className}` : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={ref}
      >
        <div className="ui-dialog-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="ui-close" onClick={() => latestPropsRef.current.onClose()} aria-label={t('ui.close')}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}
