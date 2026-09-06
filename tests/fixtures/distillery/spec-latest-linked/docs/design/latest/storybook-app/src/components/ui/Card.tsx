import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverable?: boolean
  /** padding を外す（テーブルをそのまま入れる場合） */
  flush?: boolean
}

export const Card: React.FC<CardProps> = ({
  hoverable = false,
  flush = false,
  children,
  className = '',
  style,
  ...rest
}) => (
  <div
    {...rest}
    data-hoverable={hoverable}
    className={`ds-card ${className}`}
    style={{
      background: 'var(--card-bg)',
      border: '1px solid var(--card-border)',
      borderRadius: 'var(--card-radius)',
      boxShadow: 'var(--card-shadow)',
      padding: flush ? 0 : 'var(--card-padding)',
      color: 'var(--foreground)',
      overflow: 'hidden',
      ...style,
    }}
  >
    {children}
  </div>
)

export interface CardHeaderProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
}

export const CardHeader: React.FC<CardHeaderProps> = ({
  title,
  description,
  actions,
  className = '',
  style,
  ...rest
}) => (
  <div
    {...rest}
    className={`flex items-start justify-between gap-4 ${className}`}
    style={{ marginBottom: 'var(--component-gap)', ...style }}
  >
    <div style={{ minWidth: 0 }}>
      <h3
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          color: 'var(--foreground)',
          lineHeight: 'var(--line-height-tight)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      {description && (
        <p
          style={{
            fontSize: 'var(--font-size-sm)',
            color: 'var(--foreground-secondary)',
            marginTop: 'var(--spacing-1)',
            margin: 0,
          }}
        >
          {description}
        </p>
      )}
    </div>
    {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
  </div>
)
