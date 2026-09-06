import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Table, type TableColumn } from '@/components/ui/Table'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { searchConditionTypes, genres, materialTypes } from '@/components/domain/stateMaps'
import type { BookState } from '@/components/domain/stateMaps'

/**
 * レファレンス検索画面（/staff/books/reference-search）。
 * UC 固有コンポーネント ReferenceSearchFilter / ReferenceResultTable を、
 * 共通コンポーネント FilterPanel（BookSearchFilter を内包）+ DataListSection（Table スロット）の
 * 薄いアダプタとして実装する。窓口対応中の使用を想定し、条件・結果を画面ローカルで保持する。
 */

interface ReferenceResultItem {
  bookId: string
  title: string
  author: string
  isbn: string
  genre: string
  materialType: string
  state: BookState
}

interface ReferenceQuery {
  conditionType: string[]
  keyword: string
  genres: string[]
  materialTypes: string[]
}

const emptyQuery: ReferenceQuery = { conditionType: ['キーワード'], keyword: '', genres: [], materialTypes: [] }

const sampleResults: ReferenceResultItem[] = [
  { bookId: 'B-000001', title: '吾輩は猫である', author: '夏目漱石', isbn: '9784101010359', genre: '文学', materialType: '紙書籍', state: '在庫あり' },
  { bookId: 'B-000002', title: '坊っちゃん', author: '夏目漱石', isbn: '9784101010342', genre: '文学', materialType: '紙書籍', state: '貸出中' },
  { bookId: 'B-000003', title: 'こころ', author: '夏目漱石', isbn: '9784101010328', genre: '文学', materialType: '紙書籍', state: '予約待ち' },
]

const columns: TableColumn<ReferenceResultItem>[] = [
  { key: 'bookId', header: '書籍ID', mono: true, width: '8rem', render: (r) => r.bookId },
  { key: 'title', header: '書名', render: (r) => r.title },
  { key: 'author', header: '著者', render: (r) => r.author },
  { key: 'isbn', header: 'ISBN', mono: true, width: '10rem', render: (r) => r.isbn },
  { key: 'genre', header: 'ジャンル', width: '6rem', render: (r) => r.genre },
  { key: 'state', header: '在庫状況', width: '9rem', render: (r) => <BookStatusBadge state={r.state} dot /> },
]

function buildFields(query: ReferenceQuery): FilterFieldSpec[] {
  return [
    { key: 'conditionType', label: '検索条件種別', kind: 'single', options: searchConditionTypes.map((v) => ({ value: v, label: v })), value: query.conditionType },
    { key: 'keyword', label: '検索語', kind: 'text', value: query.keyword },
    { key: 'genres', label: 'ジャンル', kind: 'multi', options: genres.map((v) => ({ value: v, label: v })), value: query.genres },
    { key: 'materialTypes', label: '資料種別', kind: 'multi', options: materialTypes.map((v) => ({ value: v, label: v })), value: query.materialTypes },
  ]
}

function ReferenceSearchScreen({
  mode = 'default',
}: {
  mode?: 'default' | 'empty' | 'error'
}) {
  const [query, setQuery] = React.useState<ReferenceQuery>({ ...emptyQuery, keyword: '夏目漱石', conditionType: ['著者'] })
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(true)

  const onChange = (key: string, value: string[] | string) => {
    setQuery((q) => ({ ...q, [key]: value }))
  }

  const onSubmit = () => {
    setLoading(true)
    setSubmitted(true)
    window.setTimeout(() => setLoading(false), 400)
  }

  const isEmpty = mode === 'empty'
  const isError = mode === 'error'
  const results = isEmpty || isError ? [] : sampleResults

  return (
    <PortalPageLayout
      portal="staff"
      title="レファレンス検索"
      description="利用者の問合せに応じて蔵書を検索し、結果を表形式で提示します。"
      breadcrumb={[{ label: '蔵書管理業務', href: '#' }, { label: 'レファレンス検索' }]}
      activeNavId="collection"
      width="full"
    >
      <DataListSection
        filter={
          <FilterPanel
            fields={buildFields(query)}
            onChange={onChange}
            onSubmit={onSubmit}
            onReset={() => setQuery(emptyQuery)}
            resultCount={submitted ? results.length : undefined}
            collapsedByDefault
            submitting={loading}
          />
        }
        table={
          <Table
            caption="レファレンス検索結果"
            rowKey={(r) => r.bookId}
            rows={results}
            columns={columns}
            empty={<span />}
          />
        }
        page={page}
        totalPages={isEmpty || isError ? 0 : 1}
        onPageChange={setPage}
        total={results.length}
        loading={loading}
        error={isError ? '検索できませんでした。時間をおいて再度お試しください。' : null}
        isEmpty={isEmpty}
        emptyMessage="条件に一致する蔵書がありません。検索条件を変更してください。"
        onRetry={isError ? onSubmit : undefined}
        skeleton="table"
      />
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/レファレンス検索画面',
  component: ReferenceSearchScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '司書向けレファレンス検索画面。FilterPanel（BookSearchFilter 内包）+ DataListSection（Table スロット）+ BookStatusBadge の合成。',
      },
    },
  },
} satisfies Meta<typeof ReferenceSearchScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <ReferenceSearchScreen mode="default" />,
}

export const Empty: Story = {
  render: () => <ReferenceSearchScreen mode="empty" />,
}

export const SearchFailed: Story = {
  render: () => <ReferenceSearchScreen mode="error" />,
}
