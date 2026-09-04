import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { ConfirmPage } from '@/components/common/ConfirmPage'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface BookDeletePageProps {
  book: Book
  deletable: boolean
}

/** 書籍削除確認画面。在庫あり = destructive（削除可）、貸出中・予約待ち = blocked（削除不可）。 */
const BookDeletePage: React.FC<BookDeletePageProps> = ({ book, deletable }) => (
  <StaffLayout activeGroup="books" activeItem="bookList">
    <ConfirmPage
      title="書籍を削除しますか"
      tone="destructive"
      blocked={!deletable}
      summary={
        <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
          <p style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)', fontFamily: 'var(--font-family-mono)' }}>{book.id}</p>
          <p style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{book.title}</p>
          <p style={{ color: 'var(--foreground-secondary)' }}>
            {book.author} / {book.genre}
          </p>
          <BookStatusBadge state={book.state} dot />
        </div>
      }
      impact={
        deletable
          ? 'この操作は取り消せません。蔵書一覧から除外されます'
          : book.state === '貸出中'
            ? '貸出中のため削除できません'
            : '予約待ちのため削除できません'
      }
      loading={false}
      loadError={null}
      emptyState={{ title: '書籍が見つかりません' }}
      submitting={false}
      confirmLabel="削除する"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </StaffLayout>
)

const meta: Meta<typeof BookDeletePage> = {
  title: 'Pages/司書ポータル/書籍削除確認画面',
  component: BookDeletePage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookDeletePage>

export const Deletable: Story = {
  render: () => <BookDeletePage book={sampleBooks[0]} deletable />,
}

export const Blocked: Story = {
  render: () => <BookDeletePage book={sampleBooks[1]} deletable={false} />,
}
