import React from 'react'
import { Button } from '../ui/Button'
import { Table, type Column } from '../ui/Table'
import { BookStatusBadge } from './StatusBadges'
import { formatDate, type Book } from './types'

export interface BookTableProps {
  books: Book[]
  variant?: 'manage' | 'inventory' | 'select'
  loading?: boolean
  onEdit?: (book: Book) => void
  onDelete?: (book: Book) => void
  onSelect?: (book: Book) => void
}

/** 司書向け書籍テーブル（属性数 8 → フル幅テーブル） */
export const BookTable: React.FC<BookTableProps> = ({ books, variant = 'manage', loading, onEdit, onDelete, onSelect }) => {
  const columns: Column<Book>[] = [
    { key: 'id', header: '書籍 ID', render: (b) => b.id, mono: true, width: '7rem' },
    {
      key: 'title',
      header: 'タイトル / 著者',
      render: (b) => (
        <div className="flex flex-col" style={{ gap: 2, minWidth: '12rem' }}>
          <span style={{ fontWeight: 600 }}>{b.title}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>{b.author}</span>
        </div>
      ),
    },
    { key: 'isbn', header: 'ISBN', render: (b) => b.isbn, mono: true },
    { key: 'publisher', header: '出版社', render: (b) => b.publisher },
    { key: 'genre', header: 'ジャンル', render: (b) => b.genre },
    { key: 'media', header: '媒体', render: (b) => b.media, width: '4rem' },
    { key: 'state', header: '状態', render: (b) => <BookStatusBadge state={b.state} dot /> },
  ]
  if (variant === 'inventory') {
    columns.push({ key: 'res', header: '予約', align: 'right', render: (b) => (b.reservationCount ? `${b.reservationCount} 人` : '—') })
  }
  if (variant === 'manage') {
    columns.push({ key: 'reg', header: '登録日', render: (b) => formatDate(b.registeredAt), mono: true })
    columns.push({
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (b) => (
        <div className="flex justify-end" style={{ gap: 'var(--spacing-1)' }}>
          <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit?.(b)} aria-label={`${b.title} を編集`}>
            編集
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete?.(b)} aria-label={`${b.title} を削除`} disabled={b.state !== '在庫あり'} title={b.state !== '在庫あり' ? '貸出中・予約待ちの書籍は削除できません' : undefined}>
            削除
          </Button>
        </div>
      ),
    })
  }
  if (variant === 'select') {
    columns.push({
      key: 'select',
      header: '',
      align: 'right',
      render: (b) => (
        <Button size="sm" variant="outline" iconRight="arrow-right" onClick={() => onSelect?.(b)}>
          選択
        </Button>
      ),
    })
  }
  return <Table columns={columns} rows={books} rowKey={(b) => b.id} loading={loading} caption="書籍一覧" emptyTitle="該当する書籍がありません" emptyDescription="検索条件を変えるか、書籍を登録してください" />
}
