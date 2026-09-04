import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { ScopeToggle } from '@/components/common/ScopeToggle'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { NoticeAlert } from '@/components/common/NoticeAlert'
import { ReservationTable } from '@/components/domain/LoanTables'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Reservation } from '@/components/domain/types'

const myReservations: Reservation[] = [
  { id: 'R-1', book: sampleBooks[1], userNumber: 'U-000123', userName: '山田 花子', acceptedAt: '2026-08-30T10:00:00', position: 3, state: '予約中' },
]

const myReservationsNotified: Reservation[] = [
  { id: 'R-2', book: sampleBooks[0], userNumber: 'U-000123', userName: '山田 花子', acceptedAt: '2026-08-15T09:00:00', position: 1, state: '通知済み' },
]

/** マイ予約状況画面（/me/reservations）。ReservationTable + 行ごとの ReservationQueueTracker。 */
const MyReservationsPage: React.FC<{ reservations: Reservation[]; notice?: 'cancelled' | 'created' | null }> = ({ reservations, notice = null }) => {
  const [includeClosed, setIncludeClosed] = useState('false')
  const active = reservations.filter((r) => r.state !== '取消')
  return (
    <PatronLayout activeNav="myReservations" userName="山田 花子">
      <PageHeader
        title="マイ予約状況"
        notices={<NoticeAlert notice={notice} messages={{ cancelled: '予約を取り消しました', created: '予約を受け付けました' }} onDismiss={() => {}} />}
      />
      <PaginatedListFrame
        filter={
          <ScopeToggle
            options={[
              { value: 'false', label: '予約中の書籍' },
              { value: 'true', label: '取消・終了も表示' },
            ]}
            value={includeClosed}
            onChange={setIncludeClosed}
            ariaLabel="表示範囲"
          />
        }
        page={1}
        totalCount={reservations.length}
        onPageChange={() => {}}
        loading={false}
        error={null}
        empty={reservations.length === 0}
        emptyState={{ title: '予約中の書籍はありません', action: { label: '蔵書を検索する', onClick: () => {} } }}
        skeleton={{ variant: 'table' }}
      >
        <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
          <ReservationTable reservations={reservations} showUser={false} onCancel={() => {}} />
          {active.map((r) => (
            <div key={r.id} className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>{r.book.title}</span>
              {r.state === '通知済み' ? <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>来館してください（2026/08/15 に通知）</span> : null}
              <ReservationQueueTracker state={r.state} position={r.position} total={active.length} compact />
            </div>
          ))}
        </div>
      </PaginatedListFrame>
    </PatronLayout>
  )
}

const meta: Meta<typeof MyReservationsPage> = {
  title: 'Pages/利用者ポータル/マイ予約状況画面',
  component: MyReservationsPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof MyReservationsPage>

export const Default: Story = {
  render: () => <MyReservationsPage reservations={myReservations} />,
}

export const Notified: Story = {
  render: () => <MyReservationsPage reservations={myReservationsNotified} />,
}

export const Empty: Story = {
  render: () => <MyReservationsPage reservations={[]} />,
}
