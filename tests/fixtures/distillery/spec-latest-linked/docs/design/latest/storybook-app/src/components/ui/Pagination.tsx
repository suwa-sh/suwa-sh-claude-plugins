import React from 'react'
import { Icon } from './Icon'

export interface PaginationProps {
  page: number
  totalPages: number
  onChange: (page: number) => void
  /** 総件数（「全 N 件」表示用） */
  totalCount?: number
  pageSize?: number
}

/**
 * NFR B.1.1.1（同時アクセス 〜100 / 登録利用者 〜1,000）の規模では
 * 仮想スクロールは不要と判断し、ページネーション（既定 20 件/頁）で一覧を分割する。
 */
export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  onChange,
  totalCount,
  pageSize = 20,
}) => {
  const pages = React.useMemo(() => {
    const out: number[] = []
    const start = Math.max(1, Math.min(page - 2, totalPages - 4))
    const end = Math.min(totalPages, Math.max(page + 2, 5))
    for (let i = start; i <= end; i++) out.push(i)
    return out
  }, [page, totalPages])

  const itemStyle = (active: boolean): React.CSSProperties => ({
    minWidth: 'var(--pagination-item-size)',
    height: 'var(--pagination-item-size)',
    padding: '0 var(--spacing-2)',
    borderRadius: 'var(--pagination-radius)',
    border: `1px solid ${active ? 'var(--primary)' : 'var(--border)'}`,
    background: active ? 'var(--primary)' : 'var(--background)',
    color: active ? 'var(--primary-foreground)' : 'var(--foreground-secondary)',
    fontSize: 'var(--font-size-xs)',
    fontVariantNumeric: 'tabular-nums',
    cursor: 'pointer',
    lineHeight: 1,
  })

  return (
    <nav
      aria-label="ページ送り"
      className="flex flex-wrap items-center justify-between"
      style={{ gap: 'var(--component-gap)' }}
    >
      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
        {totalCount != null
          ? `全 ${totalCount.toLocaleString('ja-JP')} 件 / ${pageSize} 件ずつ表示`
          : `${totalPages} ページ中 ${page} ページ目`}
      </span>
      <div className="flex items-center" style={{ gap: 'var(--spacing-1)' }}>
        <button
          type="button"
          className="ds-page-item inline-flex items-center justify-center"
          data-active="false"
          aria-label="前のページ"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          style={{ ...itemStyle(false), opacity: page <= 1 ? 0.45 : 1, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}
        >
          <Icon name="arrow-left" size={14} />
        </button>
        {pages.map((p) => (
          <button
            key={p}
            type="button"
            className="ds-page-item inline-flex items-center justify-center"
            data-active={p === page}
            aria-current={p === page ? 'page' : undefined}
            onClick={() => onChange(p)}
            style={itemStyle(p === page)}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          className="ds-page-item inline-flex items-center justify-center"
          data-active="false"
          aria-label="次のページ"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
          style={{
            ...itemStyle(false),
            opacity: page >= totalPages ? 0.45 : 1,
            cursor: page >= totalPages ? 'not-allowed' : 'pointer',
          }}
        >
          <Icon name="arrow-right" size={14} />
        </button>
      </div>
    </nav>
  )
}
