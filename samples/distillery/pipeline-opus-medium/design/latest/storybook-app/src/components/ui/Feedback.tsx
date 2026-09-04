import React from 'react'
import { Icon } from './Icon'

/* ---------------------------------------------------------------- Alert */

export type AlertTone = 'info' | 'success' | 'warning' | 'destructive'

export interface AlertProps {
  tone?: AlertTone
  title: React.ReactNode
  children?: React.ReactNode
  actions?: React.ReactNode
}

const alertToken: Record<AlertTone, { bg: string; fg: string; icon: string }> = {
  info: { bg: 'var(--info-light)', fg: 'var(--info-foreground)', icon: 'info' },
  success: { bg: 'var(--success-light)', fg: 'var(--success-foreground)', icon: 'check-circle' },
  warning: { bg: 'var(--warning-light)', fg: 'var(--warning-foreground)', icon: 'alert-triangle' },
  destructive: {
    bg: 'var(--destructive-light)',
    fg: 'var(--destructive-foreground)',
    icon: 'x-circle',
  },
}

export const Alert: React.FC<AlertProps> = ({ tone = 'info', title, children, actions }) => {
  const t = alertToken[tone]
  return (
    <div
      role={tone === 'destructive' ? 'alert' : 'status'}
      className="flex items-start"
      style={{
        gap: 'var(--spacing-3)',
        background: t.bg,
        color: t.fg,
        borderRadius: 'var(--alert-radius)',
        padding: 'var(--alert-padding)',
      }}
    >
      <span style={{ display: 'inline-flex', marginTop: 2 }}>
        <Icon name={t.icon} size={18} />
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>{title}</div>
        {children && (
          <div
            style={{
              fontSize: 'var(--font-size-sm)',
              marginTop: 'var(--spacing-1)',
              lineHeight: 'var(--line-height-normal)',
            }}
          >
            {children}
          </div>
        )}
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  )
}

/* ----------------------------------------------------------- EmptyState */

export interface EmptyStateProps {
  icon?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
}

/** NFR A（可用性）対応: 一覧系コンポーネントの 0 件表示を必ずこれで表す */
export const EmptyState: React.FC<EmptyStateProps> = ({
  icon = 'inbox',
  title,
  description,
  action,
}) => (
  <div
    className="flex flex-col items-center justify-center text-center"
    style={{
      gap: 'var(--spacing-2)',
      padding: 'var(--spacing-10) var(--spacing-6)',
      color: 'var(--foreground-secondary)',
    }}
  >
    <span style={{ color: 'var(--foreground-muted)' }}>
      <Icon name={icon} size={32} strokeWidth={1.25} />
    </span>
    <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: 'var(--foreground)' }}>
      {title}
    </div>
    {description && (
      <div style={{ fontSize: 'var(--font-size-sm)', maxWidth: '32rem' }}>{description}</div>
    )}
    {action && <div style={{ marginTop: 'var(--spacing-2)' }}>{action}</div>}
  </div>
)

/* ------------------------------------------------------------- Skeleton */

export interface SkeletonProps {
  width?: string | number
  height?: string | number
  radius?: string
}

/** NFR B.2.1.1（レスポンス 5 秒以内）対応: 待ち時間の視覚化 */
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  radius = 'var(--radius-md)',
}) => <div className="ds-skeleton" style={{ width, height, borderRadius: radius }} />

export const SkeletonTable: React.FC<{ rows?: number; cols?: number }> = ({
  rows = 5,
  cols = 4,
}) => (
  <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
    {Array.from({ length: rows }).map((_, r) => (
      <div key={r} className="flex" style={{ gap: 'var(--spacing-3)' }}>
        {Array.from({ length: cols }).map((_, c) => (
          <Skeleton key={c} height="1.25rem" />
        ))}
      </div>
    ))}
  </div>
)

/** カード一覧（検索結果・レポート KPI）の読み込み中。カードの枠と行数を先に確定させる */
export const SkeletonCard: React.FC<{ count?: number; lines?: number }> = ({
  count = 3,
  lines = 3,
}) => (
  <div className="flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="flex flex-col"
        style={{
          gap: 'var(--spacing-2)',
          padding: 'var(--card-padding)',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--card-radius)',
          background: 'var(--card-bg)',
        }}
      >
        <Skeleton width="40%" height="1.25rem" />
        {Array.from({ length: lines }).map((_, l) => (
          <Skeleton key={l} width={l === lines - 1 ? '60%' : '100%'} />
        ))}
      </div>
    ))}
  </div>
)

/** 詳細画面（見出し + 定義リスト）の読み込み中 */
export const SkeletonDetail: React.FC<{ rows?: number }> = ({ rows = 6 }) => (
  <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
    <Skeleton width="60%" height="1.75rem" />
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex" style={{ gap: 'var(--spacing-4)' }}>
          <Skeleton width="8rem" height="1.125rem" />
          <Skeleton height="1.125rem" />
        </div>
      ))}
    </div>
  </div>
)

/* -------------------------------------------------------------- Spinner */

export type SpinnerSize = 'sm' | 'md' | 'lg'
export type SpinnerVariant = 'inline' | 'button' | 'overlay'

export interface SpinnerProps {
  /** sm=1rem（本文内）/ md=1.5rem（セクション）/ lg=2.5rem（全画面） */
  size?: SpinnerSize
  /**
   * inline: 操作起点の短い待ち（既定）
   * button: ボタン内。色は currentColor に従う
   * overlay: 親要素（position: relative）を覆うブロッキング表示
   */
  variant?: SpinnerVariant
  /** スクリーンリーダーへ読ませる待ちの内容 */
  label?: string
  /** ラベルを視覚的にも表示する（overlay は既定で表示） */
  showLabel?: boolean
}

const spinnerSize: Record<SpinnerSize, { box: string; border: string }> = {
  sm: { box: 'var(--spinner-size-sm)', border: 'var(--spinner-thickness)' },
  md: { box: 'var(--spinner-size-md)', border: 'var(--spinner-thickness)' },
  lg: { box: 'var(--spinner-size-lg)', border: 'var(--spinner-thickness-lg)' },
}

/**
 * NFR B.2.1.1（レスポンス 5 秒以内）対応: レイアウトが変わらない待ちの視覚化。
 * 形が決まっている領域の読み込みは Skeleton を使い、Spinner と併用しない。
 * 使い分けは LoadingState（src/components/common/LoadingState.tsx）に集約している。
 */
export const Spinner: React.FC<SpinnerProps> = ({
  size = 'md',
  variant = 'inline',
  label = '読み込み中',
  showLabel,
}) => {
  const s = spinnerSize[size]
  const withLabel = showLabel ?? variant === 'overlay'
  const circle = (
    <span
      className="ds-spinner"
      aria-hidden="true"
      style={{
        display: 'inline-block',
        width: s.box,
        height: s.box,
        borderWidth: s.border,
        ...(variant === 'button' ? { borderTopColor: 'currentColor' } : null),
      }}
    />
  )

  const body = (
    <span
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="inline-flex items-center"
      style={{ gap: 'var(--spacing-2)', color: 'var(--foreground-secondary)' }}
    >
      {circle}
      {withLabel ? (
        <span style={{ fontSize: 'var(--font-size-sm)' }}>{label}</span>
      ) : (
        <span className="ds-sr-only">{label}</span>
      )}
    </span>
  )

  if (variant === 'overlay') return <span className="ds-spinner-overlay">{body}</span>
  return body
}
