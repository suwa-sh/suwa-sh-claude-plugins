import React from 'react'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { Badge } from '../ui/Badge'
import { BookStatusBadge } from './StatusBadges'
import type { BookState } from './stateMaps'

export interface BookSummary {
  bookId: string
  title: string
  author: string
  isbn: string
  publisher: string
  genre: string
  materialType: string
  state: BookState
}

export interface BookCardProps {
  book: BookSummary
  /** 予約件数。0 件でも件数を明示したい場合は 0 を渡す */
  reservationCount?: number
  onSelect?: () => void
  /** 右下に置く操作ボタン群 */
  actions?: React.ReactNode
}

/** 長いタイトル・著者名でも枠を破らないための共通スタイル */
const wrapAnywhere: React.CSSProperties = { overflowWrap: 'anywhere', wordBreak: 'normal' }

/**
 * 蔵書検索結果・蔵書管理台帳で使う書籍カード。
 * 表紙画像は初期リリースでは扱わないため、アイコンのプレースホルダ枠を出す。
 */
export const BookCard: React.FC<BookCardProps> = ({
  book,
  reservationCount,
  onSelect,
  actions,
}) => (
  <Card
    hoverable
    onClick={onSelect}
    role={onSelect ? 'button' : undefined}
    tabIndex={onSelect ? 0 : undefined}
    aria-label={onSelect ? `${book.title} の詳細を開く` : undefined}
    onKeyDown={
      onSelect
        ? (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onSelect()
            }
          }
        : undefined
    }
    style={{ cursor: onSelect ? 'pointer' : undefined }}
  >
    <div className="flex" style={{ gap: 'var(--component-gap)', minWidth: 0 }}>
      {/* 表紙プレースホルダ */}
      <div
        aria-hidden="true"
        className="flex items-center justify-center shrink-0"
        style={{
          width: 64,
          height: 88,
          background: 'var(--background-muted)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--foreground-muted)',
        }}
      >
        <Icon name="book" size={28} />
      </div>

      <div className="flex flex-col flex-1 min-w-0" style={{ gap: 'var(--spacing-2)' }}>
        <h3
          title={book.title}
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            color: 'var(--foreground)',
            lineHeight: 'var(--line-height-tight)',
            margin: 0,
            display: '-webkit-box',
            WebkitBoxOrient: 'vertical',
            WebkitLineClamp: 2,
            overflow: 'hidden',
            ...wrapAnywhere,
          }}
        >
          {book.title}
        </h3>

        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)', minWidth: 0 }}>
          <span
            style={{
              fontSize: 'var(--font-size-sm)',
              color: 'var(--foreground-secondary)',
              ...wrapAnywhere,
            }}
          >
            {book.author}
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
              ...wrapAnywhere,
            }}
          >
            {book.publisher}
          </span>
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
              fontFamily: 'var(--font-family-mono)',
              fontVariantNumeric: 'tabular-nums',
              ...wrapAnywhere,
            }}
          >
            ISBN {book.isbn}
          </span>
        </div>

        <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
          <Badge variant="outline" icon="tag">
            {book.genre}
          </Badge>
          <Badge variant="outline" icon="book-open">
            {book.materialType}
          </Badge>
          <BookStatusBadge state={book.state} dot />
          {reservationCount !== undefined && (
            <span
              className="inline-flex items-center"
              style={{
                gap: 'var(--spacing-1)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--foreground-secondary)',
              }}
            >
              <Icon name="bookmark" size={12} label="予約件数" />
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {reservationCount.toLocaleString('ja-JP')}
              </span>
              件
            </span>
          )}
        </div>

        {actions && (
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            {actions}
          </div>
        )}
      </div>
    </div>
  </Card>
)
