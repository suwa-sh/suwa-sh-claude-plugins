import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { EntityFormPage } from '@/components/common/EntityFormPage'
import { BookForm } from '@/components/domain/Forms'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface BookEditPageProps {
  book: Book
  submitting?: boolean
}

/** 書籍編集画面。現在の状態バッジを見出しに添え、BookForm（edit）で更新する。 */
const BookEditPage: React.FC<BookEditPageProps> = ({ book, submitting = false }) => (
  <StaffLayout activeGroup="books" activeItem="bookEdit">
    <EntityFormPage
      mode="edit"
      title={`書籍を編集（${book.id}）`}
      status={<BookStatusBadge state={book.state} dot />}
      submitting={submitting}
      onCancel={() => {}}
    >
      {({ fieldErrors }) => (
        <BookForm
          mode="edit"
          initial={book}
          errors={fieldErrors}
          submitting={submitting}
          onSubmit={() => {}}
          onCancel={() => {}}
        />
      )}
    </EntityFormPage>
  </StaffLayout>
)

const meta: Meta<typeof BookEditPage> = {
  title: 'Pages/司書ポータル/書籍編集画面',
  component: BookEditPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookEditPage>

export const Default: Story = {
  render: () => <BookEditPage book={sampleBooks[0]} />,
}

export const Submitting: Story = {
  render: () => <BookEditPage book={sampleBooks[1]} submitting />,
}
