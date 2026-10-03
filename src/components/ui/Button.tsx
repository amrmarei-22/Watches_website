import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'text'
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, disabled, children, className = '', ...props }: ButtonProps) {
  return (
    <button className={`ui-button ui-button-${variant} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <span className="ui-spinner" aria-hidden="true" />}
      <span>{children}</span>
    </button>
  )
}
