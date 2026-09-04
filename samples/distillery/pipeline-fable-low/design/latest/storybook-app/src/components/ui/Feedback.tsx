import React from 'react'
import { Icon, type IconName } from './Icon'

/* ---------- Alert ---------- */
export type AlertTone = 'info' | 'success' | 'warning' | 'destructive'

export interface AlertProps {
  tone?: AlertTone
  title?: string
  children?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

const alertIcon: Record<AlertTone, IconName> = {
  info: 'info',
  success: 'check-circle',
  warning: 'alert-triangle',
  destructive: 'x-circle',
}

export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, children, action, className = '' }) => (
  <div
    role={tone === 'destructive' || tone === 'warning' ? 'alert' : 'status'}
    className={`flex items-start gap-3 border ${className}`}
    style={{
      background: `var(--${tone}-light)`,
      borderColor: `var(--${tone})`,
      color: 'var(--foreground)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--spacing-3) var(--spacing-4)',
    }}
  >
    <span style={{ color: `var(--${tone})`, marginTop: 2 }}>
      <Icon name={alertIcon[tone]} size={18} />
    </span>
    <div className="min-w-0 flex-1">
      {title ? <p style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{title}</p> : null}
      {children ? <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{children}</div> : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
)

/* ---------- EmptyState ---------- */
export interface EmptyStateProps {
  icon?: IconName
  title: string
  description?: string
  action?: React.ReactNode
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon = 'inbox', title, description, action }) => (
  <div className="flex flex-col items-center justify-center text-center" style={{ padding: 'var(--spacing-12) var(--spacing-6)', gap: 'var(--spacing-2)' }}>
    <span style={{ color: 'var(--foreground-muted)' }}>
      <Icon name={icon} size={40} />
    </span>
    <p style={{ fontWeight: 600 }}>{title}</p>
    {description ? (
      <p style={{ color: 'var(--foreground-secondary)', fontSize: 'var(--font-size-sm)', maxWidth: '28rem' }}>{description}</p>
    ) : null}
    {action ? <div style={{ marginTop: 'var(--spacing-2)' }}>{action}</div> : null}
  </div>
)

/* ---------- Skeleton ---------- */
export interface SkeletonProps {
  width?: string | number
  height?: string | number
  className?: string
  radius?: string
}

export const Skeleton: React.FC<SkeletonProps> = ({ width = '100%', height = '1rem', className = '', radius = 'var(--radius-md)' }) => (
  <span
    aria-hidden
    className={`block ${className}`}
    style={{ width, height, borderRadius: radius, background: 'var(--background-muted)', animation: 'libro-pulse 1.6s ease-in-out infinite' }}
  />
)

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({ rows = 5, cols = 5 }) => (
  <div role="status" aria-label="読み込み中" className="flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex" style={{ gap: 'var(--spacing-3)' }}>
        {Array.from({ length: cols }).map((__, c) => (
          <Skeleton key={c} height="1.25rem" width={`${100 / cols}%`} />
        ))}
      </div>
    ))}
  </div>
)

export const SkeletonCard: React.FC = () => (
  <div role="status" aria-label="読み込み中" className="flex flex-col border" style={{ gap: 'var(--spacing-3)', padding: 'var(--card-padding)', borderRadius: 'var(--card-radius)', borderColor: 'var(--card-border)' }}>
    <Skeleton height="1.25rem" width="60%" />
    <Skeleton height="1rem" width="40%" />
    <Skeleton height="1rem" width="80%" />
  </div>
)

/* ---------- Spinner ---------- */
export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  label?: string
}
const spinnerSize = { sm: 16, md: 24, lg: 40 }

export const Spinner: React.FC<SpinnerProps> = ({ size = 'md', label = '処理中' }) => (
  <span role="status" aria-label={label} className="inline-flex items-center justify-center" style={{ animation: 'libro-spin 1s linear infinite', color: 'currentColor' }}>
    <Icon name="loader" size={spinnerSize[size]} />
  </span>
)

export const LoadingBlock: React.FC<{ message?: string }> = ({ message = '集計中です…' }) => (
  <div className="flex flex-col items-center justify-center" style={{ gap: 'var(--spacing-3)', padding: 'var(--spacing-12)', color: 'var(--foreground-secondary)' }}>
    <span style={{ color: 'var(--primary)' }}>
      <Spinner size="lg" label={message} />
    </span>
    <p style={{ fontSize: 'var(--font-size-sm)' }}>{message}</p>
  </div>
)
