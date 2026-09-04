import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { ConfirmPage } from '@/components/common/ConfirmPage'
import { BookCard } from '@/components/domain/BookCard'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

const Summary: React.FC<{ book: Book; position: number; total: number }> = ({ book, position, total }) => (
  <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
    <BookCard book={book} variant="detail" />
    <ReservationQueueTracker state="予約中" position={position} total={total} />
  </div>
)

/** 予約申込画面（/books/:bookId/reserve）。ConfirmPage を primary で表示する。 */
const ReservationApplyPage: React.FC<{ book: Book; blocked?: boolean; submitting?: boolean }> = ({ book, blocked = false, submitting = false }) => (
  <PatronLayout activeNav="search" userName="山田 花子">
    <ConfirmPage
      title="予約を申し込みます"
      tone="primary"
      blocked={blocked}
      summary={<Summary book={book} position={3} total={3} />}
      impact={blocked ? '在庫があります。窓口でお借りいただけます' : '返却されると予約順に返却通知メールをお送りします'}
      loading={false}
      loadError={null}
      emptyState={{ title: '書籍が見つかりません' }}
      submitting={submitting}
      confirmLabel="予約を確定"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </PatronLayout>
)

const meta: Meta<typeof ReservationApplyPage> = {
  title: 'Pages/利用者ポータル/予約申込画面',
  component: ReservationApplyPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ReservationApplyPage>

export const OnLoan: Story = {
  render: () => <ReservationApplyPage book={sampleBooks[1]} />,
}

export const AlreadyAvailable: Story = {
  render: () => <ReservationApplyPage book={sampleBooks[0]} blocked />,
}

export const Submitting: Story = {
  render: () => <ReservationApplyPage book={sampleBooks[1]} submitting />,
}
