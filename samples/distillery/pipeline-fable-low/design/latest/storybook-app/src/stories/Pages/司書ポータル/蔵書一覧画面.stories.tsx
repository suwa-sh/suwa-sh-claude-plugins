import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { BookSearchFilter, emptySearch, type BookSearchValue } from '@/components/domain/BookSearchFilter'
import { BookTable } from '@/components/domain/BookTable'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface BookListPageProps {
  books: Book[]
  totalCount: number
  loading?: boolean
}

/** 蔵書一覧画面。BookSearchFilter（staff）+ BookTable（manage）+ Pagination を PaginatedListFrame で構成する。 */
const BookListPage: React.FC<BookListPageProps> = ({ books, totalCount, loading = false }) => {
  const [value, setValue] = useState<BookSearchValue>(emptySearch)
  return (
    <StaffLayout activeGroup="books" activeItem="bookList">
      <PageHeader title="蔵書一覧" primaryAction={{ label: '書籍を登録', onClick: () => {}, icon: 'plus' }} />
      <PaginatedListFrame
        filter={<BookSearchFilter value={value} onChange={setValue} onSubmit={() => {}} variant="staff" compact />}
        page={1}
        totalCount={totalCount}
        onPageChange={() => {}}
        loading={loading}
        error={null}
        empty={books.length === 0}
        emptyState={{ title: '該当する書籍がありません', action: { label: '書籍を登録', onClick: () => {} } }}
        skeleton={{ variant: 'table' }}
      >
        <BookTable books={books} variant="manage" onEdit={() => {}} onDelete={() => {}} />
      </PaginatedListFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof BookListPage> = {
  title: 'Pages/司書ポータル/蔵書一覧画面',
  component: BookListPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookListPage>

export const Default: Story = {
  render: () => <BookListPage books={sampleBooks} totalCount={sampleBooks.length} />,
}

export const Empty: Story = {
  render: () => <BookListPage books={[]} totalCount={0} />,
}

export const Loading: Story = {
  render: () => <BookListPage books={[]} totalCount={0} loading />,
}
