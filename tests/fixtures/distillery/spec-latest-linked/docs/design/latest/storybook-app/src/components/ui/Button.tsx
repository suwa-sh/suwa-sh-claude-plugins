import React from 'react'
import { Icon } from './Icon'

export type ButtonVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  /** 先頭アイコン名 */
  iconLeft?: string
  /** 末尾アイコン名 */
  iconRight?: string
  /**
   * 送信中。arch SR-002（冪等キー付与と二重送信防止）に対応し、
   * true の間はクリックを受け付けない
   */
  loading?: boolean
  fullWidth?: boolean
}

// Tailwind v4 では text-[var(--x)] が font-size と解釈されるため、色は style prop で指定する
const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
  default: {
    background: 'var(--primary)',
    color: 'var(--primary-foreground)',
    border: '1px solid var(--primary)',
  },
  secondary: {
    background: 'var(--background-muted)',
    color: 'var(--foreground)',
    border: '1px solid var(--border)',
  },
  outline: {
    background: 'transparent',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--foreground-secondary)',
    border: '1px solid transparent',
  },
  destructive: {
    background: 'var(--destructive)',
    color: 'var(--color-white)',
    border: '1px solid var(--destructive)',
  },
}

const sizeStyle: Record<ButtonSize, React.CSSProperties> = {
  sm: {
    height: 'var(--button-height-sm)',
    padding: '0 var(--spacing-3)',
    fontSize: 'var(--font-size-xs)',
  },
  md: {
    height: 'var(--button-height-md)',
    padding: '0 var(--button-padding-x)',
    fontSize: 'var(--button-font-size)',
  },
  lg: {
    height: 'var(--button-height-lg)',
    padding: '0 var(--spacing-6)',
    fontSize: 'var(--font-size-base)',
  },
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  iconLeft,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  children,
  className = '',
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading
  return (
    <button
      type="button"
      {...rest}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-variant={variant}
      className={`ds-button inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors ${className}`}
      style={{
        ...variantStyle[variant],
        ...sizeStyle[size],
        borderRadius: 'var(--button-radius)',
        fontWeight: 'var(--button-font-weight)' as React.CSSProperties['fontWeight'],
        fontFamily: 'var(--font-family-sans)',
        lineHeight: 1,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.55 : 1,
        width: fullWidth ? '100%' : undefined,
        transitionDuration: 'var(--duration-fast)',
        ...style,
      }}
    >
      {loading ? (
        <Icon name="refresh-cw" size={size === 'lg' ? 18 : 14} className="ds-spin" />
      ) : (
        iconLeft && <Icon name={iconLeft} size={size === 'lg' ? 18 : 14} />
      )}
      {children}
      {!loading && iconRight && (
        <Icon name={iconRight} size={size === 'lg' ? 18 : 14} />
      )}
    </button>
  )
}
