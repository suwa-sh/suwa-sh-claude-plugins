import React from 'react'
import { EmptyState, Skeleton, SkeletonCard, SkeletonTable } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { ErrorAlert } from './ErrorAlert'
import { useDelayedLoading } from './hooks/useDelayedLoading'
import type { EmptyStateContent, NormalizedApiError, SkeletonSpec } from './types'

export interface AsyncStateViewProps {
  loading: boolean
  error: NormalizedApiError | null
  empty: boolean
  skeleton: SkeletonSpec
  emptyState: EmptyStateContent
  onRetry?: () => void
  /** Skeleton 表示までの遅延（既定 400ms。Doherty Threshold） */
  delayMs?: number
  /** Skeleton に添える文言（分析画面の「集計中…」） */
  loadingLabel?: string
  children: React.ReactNode
}

const SkeletonBody: React.FC<{ skeleton: SkeletonSpec; loadingLabel?: string }> = ({ skeleton, loadingLabel }) => {
  const count = skeleton.count ?? (skeleton.variant === 'card' ? 3 : 6)
  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
      {loadingLabel ? (
        <p role="status" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
          {loadingLabel}
        </p>
      ) : null}
      {skeleton.variant === 'table' ? (
        <SkeletonTable rows={count} />
      ) : skeleton.variant === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--spacing-4)' }}>
          {Array.from({ length: count }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
          {Array.from({ length: count }).map((_, i) => (
            <Skeleton key={i} height="1.25rem" />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * ローディング（0.4 秒遅延 Skeleton）/ エラー（ErrorAlert + 再試行）/ 空状態（EmptyState）/ コンテンツの出し分けを 1 か所で行う。
 * 404（対象不在）は emptyState に寄せ、5xx / ネットワーク断は ErrorAlert に寄せる。振り分けは error.kind で行う。
 */
export const AsyncStateView: React.FC<AsyncStateViewProps> = ({ loading, error, empty, skeleton, emptyState, onRetry, delayMs = 400, loadingLabel, children }) => {
  const showSkeleton = useDelayedLoading(loading, delayMs)

  if (loading) {
    return showSkeleton ? <SkeletonBody skeleton={skeleton} loadingLabel={loadingLabel} /> : null
  }

  const emptyStateAction = emptyState.action ? (
    <Button variant="secondary" size="sm" onClick={emptyState.action.onClick}>
      {emptyState.action.label}
    </Button>
  ) : undefined

  if (error) {
    if (error.kind === 'notFound') {
      return <EmptyState icon="search" title={emptyState.title} description={emptyState.description} action={emptyStateAction} />
    }
    return <ErrorAlert error={error} onRetry={onRetry} />
  }

  if (empty) {
    return <EmptyState title={emptyState.title} description={emptyState.description} action={emptyStateAction} />
  }

  return <>{children}</>
}
