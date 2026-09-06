import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Button } from '@/components/ui/Button'
import { Table, type TableColumn } from '@/components/ui/Table'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import type { BookSummary } from '@/components/domain/BookCard'
import { genres, materialTypes } from '@/components/domain/stateMaps'

/**
 * 蔵書管理台帳画面（/staff/books）。
 * UC 固有コンポーネント BookLedgerTable / BookLedgerFilter を、
 * 共通コンポーネント DataListSection（フィルター → 一覧 → ページ送り）+
 * FilterPanel の薄いアダプタとして実装する。
 */

const allBooks: BookSummary[] = [
  { bookId: 'BK-000001', title: '吾輩は猫である', author: '夏目漱石', isbn: '978-4-10-101035-9', publisher: '新潮社', genre: '文学', materialType: '紙書籍', state: '在庫あり' },
  { bookId: 'BK-000002', title: '銀河鉄道の夜', author: '宮沢賢治', isbn: '978-4-10-107404-8', publisher: '新潮社', genre: '文学', materialType: '紙書籍', state: '貸出中' },
  { bookId: 'BK-000003', title: '坊っちゃん', author: '夏目漱石', isbn: '978-4-10-101034-2', publisher: '新潮社', genre: '文学', materialType: '紙書籍', state: '予約待ち' },
  { bookId: 'BK-000004', title: '遠野物語', author: '柳田国男', isbn: '978-4-00-311661-9', publisher: '岩波書店', genre: '人文', materialType: '紙書籍', state: '在庫あり' },
  { bookId: 'BK-000005', title: '雪国', author: '川端康成', isbn: '978-4-10-100101-2', publisher: '新潮社', genre: '文学', materialType: '紙書籍', state: '在庫あり' },
]

const columns: TableColumn<BookSummary>[] = [
  { key: 'bookId', header: '書籍ID', render: (b) => b.bookId, mono: true, width: '9rem' },
  { key: 'title', header: 'タイトル', render: (b) => b.title },
  { key: 'author', header: '著者', render: (b) => b.author },
  { key: 'genre', header: 'ジャンル', render: (b) => b.genre, width: '6rem' },
  { key: 'state', header: '書籍状態', render: (b) => <BookStatusBadge state={b.state} dot />, width: '8rem' },
  {
    key: 'actions',
    header: '操作',
    render: () => (
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        <Button variant="outline" size="sm" iconLeft="edit">
          編集
        </Button>
        <Button variant="outline" size="sm" iconLeft="trash">
          除籍
        </Button>
      </div>
    ),
    width: '11rem',
  },
]

function BookLedgerScreen({
  loading = false,
  error = null,
  books = allBooks,
}: {
  loading?: boolean
  error?: string | null
  books?: BookSummary[]
}) {
  const [keyword, setKeyword] = React.useState('')
  const [genreFilter, setGenreFilter] = React.useState<string[]>([])
  const [page, setPage] = React.useState(1)

  const fields: FilterFieldSpec[] = [
    { key: 'keyword', label: '検索キーワード', kind: 'text', value: keyword },
    { key: 'genre', label: 'ジャンル', kind: 'multi', options: genres.map((g) => ({ value: g, label: g })), value: genreFilter },
    { key: 'materialType', label: '資料種別', kind: 'multi', options: materialTypes.map((m) => ({ value: m, label: m })), value: [] },
  ]

  const onChange = (key: string, value: string[] | string) => {
    if (key === 'keyword') setKeyword(value as string)
    if (key === 'genre') setGenreFilter(value as string[])
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="蔵書管理台帳"
      breadcrumb={[{ label: '蔵書管理台帳' }]}
      activeNavId="collection"
      width="full"
      actions={
        <Button variant="default" iconLeft="plus">
          新規登録
        </Button>
      }
    >
      <DataListSection
        filter={
          <FilterPanel
            fields={fields}
            onChange={onChange}
            onSubmit={() => setPage(1)}
            onReset={() => {
              setKeyword('')
              setGenreFilter([])
              setPage(1)
            }}
            resultCount={books.length}
          />
        }
        table={<Table columns={columns} rows={books} rowKey={(b) => b.bookId} caption="蔵書一覧" />}
        page={page}
        totalPages={books.length > 0 ? 3 : 1}
        onPageChange={setPage}
        total={books.length}
        loading={loading}
        error={error}
        isEmpty={books.length === 0}
        emptyMessage="条件に一致する蔵書がありません"
        emptyAction={<Button variant="outline">絞り込みを解除</Button>}
        onRetry={() => undefined}
      />
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/蔵書管理台帳画面',
  component: BookLedgerScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BookLedgerScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <BookLedgerScreen />,
}

export const Loading: Story = {
  render: () => <BookLedgerScreen loading />,
}

export const Empty: Story = {
  render: () => <BookLedgerScreen books={[]} />,
}

export const Error: Story = {
  render: () => <BookLedgerScreen error="蔵書一覧を取得できませんでした" />,
}
