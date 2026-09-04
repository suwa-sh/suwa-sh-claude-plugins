import React from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AsyncStateView } from './AsyncStateView'
import type { EmptyStateContent, NormalizedApiError, SkeletonSpec } from './types'

export interface PaginatedListFrameProps {
  /** 上部のフィルター（BookSearchFilter / KeywordSearchInput / ScopeToggle） */
  filter?: React.ReactNode
  /** 件数表示や StatCardGroup */
  summary?: React.ReactNode
  page: number
  totalCount: number
  /** 既定 20（NFR 性能: 一覧 5 秒以内） */
  pageSize?: number
  onPageChange: (page: number) => void
  loading: boolean
  error: NormalizedApiError | null
  empty: boolean
  emptyState: EmptyStateContent
  onRetry?: () => void
  skeleton: SkeletonSpec
  children: React.ReactNode
}

/**
 * フィルター + 一覧 + Pagination の縦配置と、URL クエリとの双方向同期の受け皿を提供する。
 * ページ変更は呼び出し側が URL クエリ更新 + 再取得を行う。1 ページのときは Pagination が single-page 表示になる。
 */
export const PaginatedListFrame: React.FC<PaginatedListFrameProps> = ({ filter, summary, page, totalCount, pageSize = 20, onPageChange, loading, error, empty, emptyState, onRetry, skeleton, children }) => (
  <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
    {filter ? <div>{filter}</div> : null}
    {summary ? <div>{summary}</div> : null}
    <AsyncStateView loading={loading} error={error} empty={empty} skeleton={skeleton} emptyState={emptyState} onRetry={onRetry}>
      <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
        {children}
        <Pagination page={page} pageSize={pageSize} total={totalCount} onChange={onPageChange} />
      </div>
    </AsyncStateView>
  </div>
)
