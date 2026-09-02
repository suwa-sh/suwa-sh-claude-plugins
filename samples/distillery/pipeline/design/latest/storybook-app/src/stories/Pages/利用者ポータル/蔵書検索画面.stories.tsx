import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import { searchConditionTypes, genres, materialTypes } from '@/components/domain/stateMaps'

/**
 * 蔵書検索画面（/search）。
 * UC 固有コンポーネント BookSearchPanel / BookSearchResultList を、
 * 共通コンポーネント FilterPanel（BookSearchFilter を内包）+ DataListSection（BookCard グリッドをスロットに差す）の
 * 薄いアダプタとして実装する。検索条件はルーティングのクエリパラメータと同期する想定（useListQueryState）。
 */

interface SearchQuery {
  conditionType: string[]
  keyword: string
  genres: string[]
  materialTypes: string[]
  inStockOnly: string[]
}

const emptyQuery: SearchQuery = {
  conditionType: ['キーワード'],
  keyword: '',
  genres: [],
  materialTypes: [],
  inStockOnly: [],
}

const sampleBooks: BookSummary[] = [
  {
    bookId: 'B-000001',
    title: '吾輩は猫である',
    author: '夏目漱石',
    isbn: '9784101010359',
    publisher: '新潮社',
    genre: '文学',
    materialType: '紙書籍',
    state: '在庫あり',
  },
  {
    bookId: 'B-000002',
    title: '銀河鉄道の夜',
    author: '宮沢賢治',
    isbn: '9784003110537',
    publisher: '岩波書店',
    genre: '文学',
    materialType: '紙書籍',
    state: '貸出中',
  },
  {
    bookId: 'B-000003',
    title: '人間失格',
    author: '太宰治',
    isbn: '9784101006053',
    publisher: '新潮社',
    genre: '文学',
    materialType: '紙書籍',
    state: '予約待ち',
  },
]

function buildFields(query: SearchQuery): FilterFieldSpec[] {
  return [
    { key: 'conditionType', label: '検索条件種別', kind: 'single', options: searchConditionTypes.map((v) => ({ value: v, label: v })), value: query.conditionType },
    { key: 'keyword', label: 'キーワード', kind: 'text', value: query.keyword },
    { key: 'genres', label: 'ジャンル', kind: 'multi', options: genres.map((v) => ({ value: v, label: v })), value: query.genres },
    { key: 'materialTypes', label: '資料種別', kind: 'multi', options: materialTypes.map((v) => ({ value: v, label: v })), value: query.materialTypes },
  ]
}

function BookSearchScreen({ mode = 'default' }: { mode?: 'default' | 'empty' | 'error' | 'no-keyword' }) {
  const [query, setQuery] = React.useState<SearchQuery>(
    mode === 'no-keyword' ? emptyQuery : { ...emptyQuery, keyword: '漱石' },
  )
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(false)
  const [selected, setSelected] = React.useState<string | null>(null)

  const onChange = (key: string, value: string[] | string) => setQuery((q) => ({ ...q, [key]: value }))
  const onSubmit = () => {
    if (!query.keyword) return
    setLoading(true)
    window.setTimeout(() => setLoading(false), 400)
  }

  const isEmpty = mode === 'empty'
  const isError = mode === 'error'
  const results = isEmpty || isError || mode === 'no-keyword' ? [] : sampleBooks

  return (
    <PortalPageLayout
      portal="patron"
      title="蔵書をさがす"
      description="書名・著者・ISBN などから蔵書を検索できます。"
      breadcrumb={[{ label: '蔵書をさがす' }]}
      activeNavId="search"
      width="full"
    >
      <DataListSection
        filter={
          <FilterPanel
            fields={buildFields(query)}
            onChange={onChange}
            onSubmit={onSubmit}
            onReset={() => setQuery(emptyQuery)}
            resultCount={results.length}
            collapsedByDefault
            submitting={loading}
          />
        }
        table={
          <div
            className="grid"
            style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(18rem, 1fr))', gap: 'var(--component-gap)' }}
          >
            {results.map((book) => (
              <BookCard
                key={book.bookId}
                book={book}
                reservationCount={book.state === '予約待ち' ? 3 : undefined}
                onSelect={() => setSelected(book.bookId)}
              />
            ))}
          </div>
        }
        page={page}
        totalPages={results.length > 0 ? 1 : 0}
        onPageChange={setPage}
        total={results.length}
        loading={loading}
        error={isError ? '検索できませんでした。時間をおいて再度お試しください。' : null}
        isEmpty={isEmpty || mode === 'no-keyword'}
        emptyMessage={
          mode === 'no-keyword'
            ? 'キーワードを入力して検索してください。'
            : '条件に一致する書籍がありません。検索条件を変更してください。'
        }
        onRetry={isError ? onSubmit : undefined}
        skeleton="line"
      />
      {selected && (
        <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
          選択中: {selected}（書籍詳細・在庫状況画面へ遷移します）
        </p>
      )}
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/利用者ポータル/蔵書検索画面',
  component: BookSearchScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '利用者向け蔵書検索画面。FilterPanel（BookSearchFilter 内包）+ DataListSection（BookCard グリッドをスロットに差す）の合成。',
      },
    },
  },
} satisfies Meta<typeof BookSearchScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <BookSearchScreen mode="default" />,
}

export const EmptyKeyword: Story = {
  name: 'SearchDisabled（キーワード未入力）',
  render: () => <BookSearchScreen mode="no-keyword" />,
}

export const Empty: Story = {
  render: () => <BookSearchScreen mode="empty" />,
}

export const SearchFailed: Story = {
  render: () => <BookSearchScreen mode="error" />,
}
