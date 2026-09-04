import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { ConfirmPage } from '@/components/common/ConfirmPage'
import { ReservationStatusBadge } from '@/components/domain/StatusBadges'
import { formatDateTime } from '@/components/domain/types'
import { sampleReservations } from '@/components/domain/sampleData'

const reservation = sampleReservations[2]

const Summary: React.FC = () => (
  <dl className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>書籍</dt>
      <dd>
        {reservation.book.title}（{reservation.book.author}）
      </dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>予約順位</dt>
      <dd>{reservation.position} 位</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>受付日時</dt>
      <dd style={{ fontFamily: 'var(--font-family-mono)' }}>{formatDateTime(reservation.acceptedAt)}</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>状態</dt>
      <dd>
        <ReservationStatusBadge state={reservation.state} dot />
      </dd>
    </div>
  </dl>
)

/** 予約取消画面（/reservations/:reservationId/cancel）。ConfirmPage を destructive で表示する。 */
const ReservationCancelPage: React.FC<{ submitting?: boolean }> = ({ submitting = false }) => (
  <PatronLayout activeNav="myReservations" userName="山田 花子">
    <ConfirmPage
      title="予約を取り消します"
      tone="destructive"
      blocked={false}
      summary={<Summary />}
      impact="取り消すと、次の順位の方に返却通知が送られます。再度予約する場合は末尾の順位になります"
      loading={false}
      loadError={null}
      emptyState={{ title: 'この予約は表示できません' }}
      submitting={submitting}
      confirmLabel="予約を取り消す"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </PatronLayout>
)

const meta: Meta<typeof ReservationCancelPage> = {
  title: 'Pages/利用者ポータル/予約取消画面',
  component: ReservationCancelPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ReservationCancelPage>

export const Default: Story = {
  render: () => <ReservationCancelPage />,
}

export const Submitting: Story = {
  render: () => <ReservationCancelPage submitting />,
}
