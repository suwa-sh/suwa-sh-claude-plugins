import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { BookSearchFilter, emptySearch, type BookSearchValue } from '@/components/domain/BookSearchFilter'
import { BookTable } from '@/components/domain/BookTable'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface CounterBookSearchPageProps {
  books: Book[]
  totalCount: number
}

/** 窓口蔵書検索画面。BookSearchFilter（staff）+ BookTable（select）で在庫状況の即答導線を提供する。 */
const CounterBookSearchPage: React.FC<CounterBookSearchPageProps> = ({ books, totalCount }) => {
  const [value, setValue] = useState<BookSearchValue>(emptySearch)
  return (
    <StaffLayout activeGroup="counter" activeItem="search">
      <PageHeader title="窓口蔵書検索" />
      <PaginatedListFrame
        filter={<BookSearchFilter value={value} onChange={setValue} onSubmit={() => {}} variant="staff" />}
        page={1}
        totalCount={totalCount}
        onPageChange={() => {}}
        loading={false}
        error={null}
        empty={books.length === 0}
        emptyState={{ title: '該当する書籍がありません' }}
        skeleton={{ variant: 'table' }}
      >
        <BookTable books={books} variant="select" onSelect={() => {}} />
      </PaginatedListFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof CounterBookSearchPage> = {
  title: 'Pages/司書ポータル/窓口蔵書検索画面',
  component: CounterBookSearchPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof CounterBookSearchPage>

export const Default: Story = {
  render: () => <CounterBookSearchPage books={sampleBooks} totalCount={sampleBooks.length} />,
}

export const Empty: Story = {
  render: () => <CounterBookSearchPage books={[]} totalCount={0} />,
}
