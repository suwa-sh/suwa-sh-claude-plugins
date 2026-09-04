import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { BookTable } from '@/components/domain/BookTable'
import { sampleBooks } from '@/components/domain/sampleData'

const meta: Meta<typeof PaginatedListFrame> = {
  title: 'Common/PaginatedListFrame',
  component: PaginatedListFrame,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PaginatedListFrame>

export const WithContent: Story = {
  render: () => (
    <PaginatedListFrame
      summary={<p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{sampleBooks.length} 件</p>}
      page={1}
      totalCount={sampleBooks.length}
      onPageChange={() => {}}
      loading={false}
      error={null}
      empty={false}
      emptyState={{ title: '該当する書籍が見つかりません' }}
      skeleton={{ variant: 'table' }}
    >
      <BookTable books={sampleBooks} />
    </PaginatedListFrame>
  ),
}

export const Empty: Story = {
  render: () => (
    <PaginatedListFrame
      page={1}
      totalCount={0}
      onPageChange={() => {}}
      loading={false}
      error={null}
      empty
      emptyState={{ title: '該当する書籍が見つかりません', description: '検索条件を変更してください' }}
      skeleton={{ variant: 'table' }}
    >
      <BookTable books={[]} />
    </PaginatedListFrame>
  ),
}

export const Loading: Story = {
  render: () => (
    <PaginatedListFrame page={1} totalCount={0} onPageChange={() => {}} loading error={null} empty={false} emptyState={{ title: '該当なし' }} skeleton={{ variant: 'table', count: 6 }}>
      <BookTable books={[]} />
    </PaginatedListFrame>
  ),
}
