import React from 'react'
import { EmptyState, Alert } from '@/components/ui/Feedback'
import { LoadingState } from '@/components/common/LoadingState'
import { Button } from '@/components/ui/Button'

export interface AsyncSectionProps {
  loading: boolean
  error: string | null
  isEmpty: boolean
  /** 既定 table（一覧）。詳細は detail、カード一覧は card、1 行だけなら line */
  skeleton?: 'line' | 'table' | 'card' | 'detail'
  /** loading の遅延表示。既定は LoadingState の 300ms。Story では 0 を渡す */
  loadingDelayMs?: number
  emptyTitle?: React.ReactNode
  emptyMessage: React.ReactNode
  emptyAction?: React.ReactNode
  onRetry?: () => void
  /** 既定 true。件数・エラーを aria-live="polite" / role="alert" で通知する */
  announce?: boolean
  /** ready 時の件数（aria-live 通知用） */
  readyCount?: number
  children: React.ReactNode
}

/**
 * 一覧系画面が同じ順序・同じ位置で 3 状態（Skeleton / EmptyState / Alert(destructive)）を出すための型。
 * ui-design.md「一覧系は EmptyState / Alert(destructive) / Skeleton の3状態を必ず実装する」を強制する。
 */
export const AsyncSection: React.FC<AsyncSectionProps> = ({
  loading,
  error,
  isEmpty,
  skeleton = 'table',
  emptyTitle = '該当する項目がありません',
  emptyMessage,
  emptyAction,
  onRetry,
  loadingDelayMs,
  announce = true,
  readyCount,
  children,
}) => {
  if (loading) {
    // loading 表現は LoadingState に集約する（画面・セクションごとに独自 UI を作らない）
    return (
      <LoadingState
        kind={skeleton === 'table' ? 'list' : skeleton}
        delayMs={loadingDelayMs}
      />
    )
  }

  if (error) {
    return (
      <Alert
        tone="destructive"
        title={error}
        actions={onRetry && (
          <Button variant="outline" size="sm" iconLeft="refresh-cw" onClick={onRetry}>
            再試行
          </Button>
        )}
      />
    )
  }

  if (isEmpty) {
    return <EmptyState title={emptyTitle} description={emptyMessage} action={emptyAction} />
  }

  return (
    <div aria-live={announce ? 'polite' : undefined}>
      {announce && readyCount != null && <span className="ds-sr-only">{readyCount} 件表示しています</span>}
      {children}
    </div>
  )
}
