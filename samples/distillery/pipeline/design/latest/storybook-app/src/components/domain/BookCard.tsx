import React from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Card } from '../ui/Card'
import { Icon } from '../ui/Icon'
import { BookStatusBadge, bookStateMap } from './StatusBadges'
import type { Book } from './types'

export interface BookCardProps {
  book: Book
  variant?: 'compact' | 'detail'
  onSelect?: (book: Book) => void
  onReserve?: (book: Book) => void
}

const Meta: React.FC<{ label: string; value: React.ReactNode; mono?: boolean }> = ({ label, value, mono }) => (
  <div className="flex flex-col" style={{ gap: 2 }}>
    <dt style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>{label}</dt>
    <dd style={{ fontSize: 'var(--font-size-sm)', fontFamily: mono ? 'var(--font-family-mono)' : undefined }}>{value}</dd>
  </div>
)

/** 利用者向け書籍カード。状態と「次にできること」をセットで示す */
export const BookCard: React.FC<BookCardProps> = ({ book, variant = 'compact', onSelect, onReserve }) => {
  const canReserve = book.media === '紙' && (book.state === '貸出中' || book.state === '予約待ち')
  if (variant === 'compact') {
    return (
      <Card as="article" variant={onSelect ? 'hoverable' : 'default'} onClick={onSelect ? () => onSelect(book) : undefined} style={{ padding: 'var(--spacing-4)' }}>
        <div className="flex items-start" style={{ gap: 'var(--spacing-3)' }}>
          <span className="flex shrink-0 items-center justify-center" style={{ width: 44, height: 56, borderRadius: 'var(--radius-md)', background: 'var(--primary-light)', color: 'var(--primary)' }}>
            <Icon name="book" size={22} />
          </span>
          <div className="min-w-0 flex-1 flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
            <h3 className="truncate" style={{ fontWeight: 600 }}>
              {book.title}
            </h3>
            <p className="truncate" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
              {book.author} / {book.publisher}
            </p>
            <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
              <BookStatusBadge state={book.state} />
              <Badge variant="outline" icon="tag">
                {book.genre}
              </Badge>
              <Badge variant="outline">{book.media}</Badge>
            </div>
          </div>
          {onSelect ? (
            <span style={{ color: 'var(--foreground-muted)' }}>
              <Icon name="chevron-right" size={18} />
            </span>
          ) : null}
        </div>
      </Card>
    )
  }
  return (
    <Card as="article">
      <div className="flex flex-col md:flex-row" style={{ gap: 'var(--spacing-6)' }}>
        <span className="flex shrink-0 items-center justify-center self-start" style={{ width: 96, height: 128, borderRadius: 'var(--radius-lg)', background: 'var(--primary-light)', color: 'var(--primary)' }}>
          <Icon name="book" size={40} />
        </span>
        <div className="min-w-0 flex-1 flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
          <div>
            <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, lineHeight: 'var(--line-height-tight)' }}>{book.title}</h2>
            <p style={{ color: 'var(--foreground-secondary)', marginTop: 'var(--spacing-1)' }}>{book.author}</p>
          </div>
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            <BookStatusBadge state={book.state} />
            <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{bookStateMap[book.state].next}</span>
            {book.reservationCount ? (
              <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>・予約 {book.reservationCount} 人待ち</span>
            ) : null}
          </div>
          <dl className="grid grid-cols-2 md:grid-cols-4" style={{ gap: 'var(--spacing-3)' }}>
            <Meta label="ISBN" value={book.isbn} mono />
            <Meta label="出版社" value={book.publisher} />
            <Meta label="ジャンル" value={book.genre} />
            <Meta label="媒体種別" value={book.media} />
          </dl>
          {onReserve ? (
            <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
              <Button icon="bookmark" disabled={!canReserve} onClick={() => onReserve(book)}>
                予約する
              </Button>
              {!canReserve ? (
                <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-muted)' }}>
                  {book.media === '電子' ? '電子書籍は予約できません' : '在庫がある書籍は予約できません。窓口で貸出を受けてください'}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  )
}
