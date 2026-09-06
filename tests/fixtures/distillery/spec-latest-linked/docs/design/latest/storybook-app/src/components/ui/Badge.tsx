import React from 'react'
import { Icon } from './Icon'

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'neutral'
  | 'pending'
  | 'analysis'
  | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** 先頭アイコン名 */
  icon?: string
  /** 左端に色ドットを出す（テーブル内の状態列で色だけに依存しないため） */
  dot?: boolean
}

const variantStyle: Record<BadgeVariant, React.CSSProperties> = {
  default: {
    background: 'var(--primary-light)',
    color: 'var(--primary)',
    border: '1px solid transparent',
  },
  success: {
    background: 'var(--success-light)',
    color: 'var(--success-foreground)',
    border: '1px solid transparent',
  },
  warning: {
    background: 'var(--warning-light)',
    color: 'var(--warning-foreground)',
    border: '1px solid transparent',
  },
  destructive: {
    background: 'var(--destructive-light)',
    color: 'var(--destructive-foreground)',
    border: '1px solid transparent',
  },
  info: {
    background: 'var(--info-light)',
    color: 'var(--info-foreground)',
    border: '1px solid transparent',
  },
  neutral: {
    background: 'var(--neutral-light)',
    color: 'var(--neutral-foreground)',
    border: '1px solid transparent',
  },
  pending: {
    background: 'var(--pending-light)',
    color: 'var(--pending-foreground)',
    border: '1px solid transparent',
  },
  analysis: {
    background: 'var(--analysis-light)',
    color: 'var(--analysis-foreground)',
    border: '1px solid transparent',
  },
  outline: {
    background: 'transparent',
    color: 'var(--foreground-secondary)',
    border: '1px solid var(--border-strong)',
  },
}

const dotColor: Record<BadgeVariant, string> = {
  default: 'var(--primary)',
  success: 'var(--success)',
  warning: 'var(--warning)',
  destructive: 'var(--destructive)',
  info: 'var(--info)',
  neutral: 'var(--neutral)',
  pending: 'var(--pending)',
  analysis: 'var(--analysis)',
  outline: 'var(--foreground-muted)',
}

/**
 * 状態表示用のラベル。
 * クリック可能な選択肢には使わない（design-lessons-learned: フィルタは ToggleGroup を使う）。
 */
export const Badge: React.FC<BadgeProps> = ({
  variant = 'default',
  icon,
  dot = false,
  children,
  className = '',
  style,
  ...rest
}) => (
  <span
    {...rest}
    className={`inline-flex items-center gap-1 whitespace-nowrap ${className}`}
    style={{
      ...variantStyle[variant],
      height: 'var(--badge-height)',
      padding: '0 var(--badge-padding-x)',
      borderRadius: 'var(--badge-radius)',
      fontSize: 'var(--badge-font-size)',
      fontWeight: 'var(--badge-font-weight)' as React.CSSProperties['fontWeight'],
      lineHeight: 1,
      ...style,
    }}
  >
    {dot && (
      <span
        aria-hidden="true"
        style={{
          width: 6,
          height: 6,
          borderRadius: 'var(--radius-full)',
          background: dotColor[variant],
          flexShrink: 0,
        }}
      />
    )}
    {icon && <Icon name={icon} size={12} />}
    {children}
  </span>
)
