import React from 'react'
import { Button } from './Button'

export interface PaginationProps {
  page: number
  pageSize?: number
  total: number
  onChange: (page: number) => void
}

/** 全一覧 20 件/頁（NFR B.1.1.1 同時〜100 では仮想スクロール不要） */
export const Pagination: React.FC<PaginationProps> = ({ page, pageSize = 20, total, onChange }) => {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <nav aria-label="ページ送り" className="flex flex-wrap items-center justify-between" style={{ gap: 'var(--spacing-3)' }}>
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
        {total.toLocaleString('ja-JP')} 件中 {from}–{to} 件
      </p>
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        <Button variant="outline" size="sm" icon="chevron-left" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="前のページ">
          前へ
        </Button>
        <span style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums' }}>
          {page} / {pages}
        </span>
        <Button variant="outline" size="sm" iconRight="chevron-right" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="次のページ">
          次へ
        </Button>
      </div>
    </nav>
  )
}
