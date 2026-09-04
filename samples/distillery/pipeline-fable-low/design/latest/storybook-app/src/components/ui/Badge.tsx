import React from 'react'
import { Icon, type IconName } from './Icon'

export type BadgeVariant =
  | 'default'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'pending'
  | 'analysis'
  | 'neutral'
  | 'outline'

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant
  /** 先頭に色ドットを表示（色 + 文言の併用） */
  dot?: boolean
  icon?: IconName
}

const palette: Record<BadgeVariant, { bg: string; fg: string; border: string }> = {
  default: { bg: 'var(--primary-light)', fg: 'var(--primary)', border: 'transparent' },
  success: { bg: 'var(--success-light)', fg: 'var(--success)', border: 'transparent' },
  warning: { bg: 'var(--warning-light)', fg: 'var(--warning)', border: 'transparent' },
  destructive: { bg: 'var(--destructive-light)', fg: 'var(--destructive)', border: 'transparent' },
  info: { bg: 'var(--info-light)', fg: 'var(--info)', border: 'transparent' },
  pending: { bg: 'var(--pending-light)', fg: 'var(--pending)', border: 'transparent' },
  analysis: { bg: 'var(--analysis-light)', fg: 'var(--analysis)', border: 'transparent' },
  neutral: { bg: 'var(--neutral-light)', fg: 'var(--neutral)', border: 'transparent' },
  outline: { bg: 'transparent', fg: 'var(--foreground-secondary)', border: 'var(--border-strong)' },
}

export const Badge: React.FC<BadgeProps> = ({ variant = 'default', dot, icon, className = '', children, style, ...rest }) => {
  const p = palette[variant]
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap border ${className}`}
      style={{
        background: p.bg,
        color: p.fg,
        borderColor: p.border,
        height: 'var(--badge-height)',
        paddingInline: 'var(--badge-padding-x)',
        borderRadius: 'var(--badge-radius)',
        fontSize: 'var(--badge-font-size)',
        fontWeight: 'var(--badge-font-weight)' as React.CSSProperties['fontWeight'],
        lineHeight: 1,
        ...style,
      }}
      {...rest}
    >
      {dot ? <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: 'currentColor' }} /> : null}
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}
