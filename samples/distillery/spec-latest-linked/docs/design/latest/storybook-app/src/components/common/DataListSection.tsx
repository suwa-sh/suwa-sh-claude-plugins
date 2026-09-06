import React from 'react'
import { Pagination } from '@/components/ui/Pagination'
import { AsyncSection, type AsyncSectionProps } from './AsyncSection'

export interface DataListSectionProps
  extends Omit<AsyncSectionProps, 'children' | 'skeleton'> {
  /** FilterPanel 等を差す */
  filter?: React.ReactNode
  /** 一覧本体（Domain テーブル優先） */
  table: React.ReactNode
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  total: number
  pageSize?: number
  skeleton?: 'line' | 'table'
}

/**
 * 「フィルター → 一覧 → ページ送り」の縦積みレイアウトと 20 件/頁の分割ルールを統一する。
 * テーブル本体は差し替え可能なスロットにし、Domain テーブルを共通層で置き換えない。
 */
export const DataListSection: React.FC<DataListSectionProps> = ({
  filter,
  table,
  page,
  totalPages,
  onPageChange,
  total,
  pageSize = 20,
  skeleton = 'table',
  ...asyncProps
}) => (
  <div className="flex flex-col" style={{ gap: 'var(--section-gap)', minWidth: 0 }}>
    {filter}
    <AsyncSection {...asyncProps} skeleton={skeleton} readyCount={total}>
      <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
        {table}
        {totalPages > 1 ? (
          <Pagination page={page} totalPages={totalPages} onChange={onPageChange} totalCount={total} pageSize={pageSize} />
        ) : (
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            全 {total.toLocaleString('ja-JP')} 件
          </span>
        )}
      </div>
    </AsyncSection>
  </div>
)
