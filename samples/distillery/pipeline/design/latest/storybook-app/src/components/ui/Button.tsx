import React from 'react'
import { Icon, type IconName } from './Icon'
import { Spinner } from './Feedback'

export type ButtonVariant = 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  icon?: IconName
  iconRight?: IconName
  /** 送信中: disabled + Spinner（SR-005 ダブルサブミット防止） */
  loading?: boolean
  fullWidth?: boolean
}

const styles: Record<ButtonVariant, React.CSSProperties> = {
  default: { background: 'var(--primary)', color: 'var(--primary-foreground)', borderColor: 'var(--primary)' },
  secondary: { background: 'var(--background-muted)', color: 'var(--foreground)', borderColor: 'var(--background-muted)' },
  outline: { background: 'transparent', color: 'var(--foreground)', borderColor: 'var(--border-strong)' },
  ghost: { background: 'transparent', color: 'var(--foreground-secondary)', borderColor: 'transparent' },
  destructive: { background: 'var(--destructive)', color: 'var(--color-white)', borderColor: 'var(--destructive)' },
}

const hoverClass: Record<ButtonVariant, string> = {
  default: 'hover:bg-primary-hover',
  secondary: 'hover:bg-hover-muted',
  outline: 'hover:bg-hover-muted',
  ghost: 'hover:bg-hover-muted',
  destructive: 'hover:brightness-95',
}

const heights: Record<ButtonSize, string> = {
  sm: 'var(--button-height-sm)',
  md: 'var(--button-height-md)',
  lg: 'var(--button-height-lg)',
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'default',
  size = 'md',
  icon,
  iconRight,
  loading = false,
  fullWidth = false,
  disabled,
  className = '',
  children,
  style,
  ...rest
}) => {
  const isDisabled = disabled || loading
  return (
    <button
      type="button"
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-2 border whitespace-nowrap transition-colors cursor-pointer disabled:cursor-not-allowed disabled:opacity-60 ${isDisabled ? '' : hoverClass[variant]} ${fullWidth ? 'w-full' : ''} ${className}`}
      style={{
        ...styles[variant],
        height: heights[size],
        paddingInline: size === 'sm' ? 'var(--spacing-3)' : 'var(--button-padding-x)',
        borderRadius: 'var(--button-radius)',
        fontSize: size === 'lg' ? 'var(--font-size-base)' : 'var(--button-font-size)',
        fontWeight: 'var(--button-font-weight)' as React.CSSProperties['fontWeight'],
        transitionDuration: 'var(--duration-fast)',
        ...style,
      }}
      {...rest}
    >
      {loading ? <Spinner size="sm" /> : icon ? <Icon name={icon} size={size === 'sm' ? 16 : 18} /> : null}
      {children}
      {iconRight && !loading ? <Icon name={iconRight} size={size === 'sm' ? 16 : 18} /> : null}
    </button>
  )
}
