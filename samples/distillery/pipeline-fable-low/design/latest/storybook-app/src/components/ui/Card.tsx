import React from 'react'

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'hoverable' | 'flush'
  as?: 'div' | 'section' | 'article'
}

export const Card: React.FC<CardProps> = ({ variant = 'default', as = 'div', className = '', style, children, ...rest }) => {
  const Tag = as
  return (
    <Tag
      className={`border ${variant === 'hoverable' ? 'cursor-pointer transition-shadow hover:shadow-md' : ''} ${className}`}
      style={{
        background: 'var(--card-bg)',
        borderColor: 'var(--card-border)',
        boxShadow: 'var(--card-shadow)',
        borderRadius: 'var(--card-radius)',
        padding: variant === 'flush' ? 0 : 'var(--card-padding)',
        overflow: variant === 'flush' ? 'hidden' : undefined,
        ...style,
      }}
      {...rest}
    >
      {children}
    </Tag>
  )
}

export interface CardHeaderProps {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}

export const CardHeader: React.FC<CardHeaderProps> = ({ title, description, action, className = '' }) => (
  <div className={`flex items-start justify-between gap-3 ${className}`} style={{ marginBottom: 'var(--component-gap)' }}>
    <div className="min-w-0">
      <h3 className="truncate" style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600, lineHeight: 'var(--line-height-tight)' }}>
        {title}
      </h3>
      {description ? (
        <p style={{ color: 'var(--foreground-secondary)', fontSize: 'var(--font-size-sm)', marginTop: 'var(--spacing-1)' }}>{description}</p>
      ) : null}
    </div>
    {action ? <div className="shrink-0">{action}</div> : null}
  </div>
)
