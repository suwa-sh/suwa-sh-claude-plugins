import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { ScopeToggle } from '@/components/common/ScopeToggle'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { CounterHandoffActions } from '@/components/common/CounterHandoffActions'
import { BookCard } from '@/components/domain/BookCard'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { ReservationTable } from '@/components/domain/LoanTables'
import { sampleBooks, sampleReservations } from '@/components/domain/sampleData'
import type { Book, Reservation } from '@/components/domain/types'

/** 書籍別予約状況画面（/staff/books/:bookId/reservations）。 */
const BookReservationsPage: React.FC<{ book: Book; reservations: Reservation[] }> = ({ book, reservations }) => {
  const [includeClosed, setIncludeClosed] = useState('false')
  const active = reservations.filter((r) => r.state !== '取消')
  const top = active[0]
  return (
    <StaffLayout activeGroup="reservations" activeItem="bookReservations" userName="佐藤 花子">
      <PageHeader title="書籍別予約状況" subtitle={book.title} status={<BookStatusBadge state={book.state} />} />
      <PaginatedListFrame
        filter={
          <ScopeToggle
            options={[
              { value: 'false', label: '有効な予約のみ' },
              { value: 'true', label: '取消・終了も表示' },
            ]}
            value={includeClosed}
            onChange={setIncludeClosed}
            size="sm"
            ariaLabel="表示範囲"
          />
        }
        summary={
          <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
            <BookCard book={book} variant="compact" />
            <ReservationQueueTracker state={book.state === '予約待ち' ? '通知済み' : '予約中'} position={active.length ? 1 : undefined} total={active.length} compact />
            <CounterHandoffActions actions={['return', 'loan']} bookId={book.id} userNumber={top?.userNumber} disabled={!top} />
          </div>
        }
        page={1}
        totalCount={reservations.length}
        onPageChange={() => {}}
        loading={false}
        error={null}
        empty={reservations.length === 0}
        emptyState={{ title: 'この書籍に予約はありません' }}
        skeleton={{ variant: 'table' }}
      >
        <ReservationTable reservations={reservations} showUser />
      </PaginatedListFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof BookReservationsPage> = {
  title: 'Pages/司書ポータル/書籍別予約状況画面',
  component: BookReservationsPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookReservationsPage>

export const Default: Story = {
  render: () => <BookReservationsPage book={sampleBooks[1]} reservations={sampleReservations.filter((r) => r.book.id === sampleBooks[1].id)} />,
}

export const Empty: Story = {
  render: () => <BookReservationsPage book={sampleBooks[0]} reservations={[]} />,
}
