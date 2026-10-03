import type { InputHTMLAttributes } from 'react'

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  error?: string
  hint?: string
}

export function Input({ label, error, hint, id, ...props }: InputProps) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(' ') || undefined
  return (
    <label className="ui-field" htmlFor={id}>
      <span className="ui-label">{label}</span>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={describedBy} {...props} />
      {hint && <span id={`${id}-hint`} className="ui-hint">{hint}</span>}
      {error && <span id={`${id}-error`} className="ui-field-error" role="alert">{error}</span>}
    </label>
  )
}
