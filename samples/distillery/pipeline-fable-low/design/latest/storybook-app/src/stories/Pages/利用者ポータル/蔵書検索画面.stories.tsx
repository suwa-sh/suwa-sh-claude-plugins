import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { BookSearchFilter, emptySearch, type BookSearchValue } from '@/components/domain/BookSearchFilter'
import { BookCard } from '@/components/domain/BookCard'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface BookSearchPageProps {
  books: Book[]
  totalCount: number
  loading?: boolean
}

/** 利用者向け蔵書検索画面。BookSearchFilter + BookCard グリッド + Pagination を PaginatedListFrame で構成する。 */
const BookSearchPage: React.FC<BookSearchPageProps> = ({ books, totalCount, loading = false }) => {
  const [value, setValue] = useState<BookSearchValue>(emptySearch)
  return (
    <PatronLayout activeNav="search">
      <PageHeader title="蔵書検索" />
      <PaginatedListFrame
        filter={<BookSearchFilter value={value} onChange={setValue} onSubmit={() => {}} variant="patron" />}
        summary={
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{totalCount} 件</p>
        }
        page={1}
        totalCount={totalCount}
        onPageChange={() => {}}
        loading={loading}
        error={null}
        empty={books.length === 0}
        emptyState={{ title: '該当する書籍が見つかりませんでした。条件を変えてお試しください' }}
        skeleton={{ variant: 'card', count: 6 }}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" style={{ gap: 'var(--spacing-4)' }}>
          {books.map((book) => (
            <BookCard key={book.id} book={book} variant="compact" onSelect={() => {}} />
          ))}
        </div>
      </PaginatedListFrame>
    </PatronLayout>
  )
}

const meta: Meta<typeof BookSearchPage> = {
  title: 'Pages/利用者ポータル/蔵書検索画面',
  component: BookSearchPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookSearchPage>

export const Default: Story = {
  render: () => <BookSearchPage books={sampleBooks} totalCount={sampleBooks.length} />,
}

export const Empty: Story = {
  render: () => <BookSearchPage books={[]} totalCount={0} />,
}

export const Loading: Story = {
  render: () => <BookSearchPage books={[]} totalCount={0} loading />,
}
