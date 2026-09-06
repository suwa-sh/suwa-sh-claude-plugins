import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BookStatusBadge, LoanStatusBadge, ReservationStatusBadge } from './StatusBadges'
import { ReservationQueueTracker } from './ReservationQueueTracker'
import { DueDateIndicator } from './DueDateIndicator'
import { PiiMaskedText } from './PiiMaskedText'

const meta: Meta = {
  title: 'Domain/Status',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const BookStatus: Story = {
  render: () => (
    <div className="flex items-center" style={{ gap: 8 }}>
      <BookStatusBadge state="在庫あり" />
      <BookStatusBadge state="貸出中" />
      <BookStatusBadge state="予約待ち" />
      <BookStatusBadge state="在庫あり" dot />
    </div>
  ),
}
export const LoanStatus: Story = {
  render: () => (
    <div className="flex items-center" style={{ gap: 8 }}>
      <LoanStatusBadge state="貸出中" />
      <LoanStatusBadge state="延滞" />
      <LoanStatusBadge state="返却済み" />
    </div>
  ),
}
export const ReservationStatus: Story = {
  render: () => (
    <div className="flex items-center" style={{ gap: 8 }}>
      <ReservationStatusBadge state="予約中" />
      <ReservationStatusBadge state="通知済み" />
      <ReservationStatusBadge state="取消" />
    </div>
  ),
}
export const QueueTracker: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 24 }}>
      <ReservationQueueTracker state="予約中" position={2} total={3} />
      <ReservationQueueTracker state="通知済み" position={1} total={2} />
      <ReservationQueueTracker state="完了" />
      <ReservationQueueTracker state="取消" position={1} compact />
    </div>
  ),
}
export const DueDate: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <DueDateIndicator dueDate="2026-09-15" today="2026-09-03" />
      <DueDateIndicator dueDate="2026-09-05" today="2026-09-03" />
      <DueDateIndicator dueDate="2026-09-03" today="2026-09-03" />
      <DueDateIndicator dueDate="2026-08-24" today="2026-09-03" />
      <DueDateIndicator dueDate="2026-07-15" today="2026-09-03" returned />
    </div>
  ),
}
export const PiiMasked: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 12 }}>
      <PiiMaskedText value="hanako.yamada@example.com" kind="email" />
      <PiiMaskedText value="090-1234-5678" kind="phone" />
      <PiiMaskedText value="東京都千代田区一ツ橋 1-1-1" kind="address" />
      <PiiMaskedText value="taro.sato@example.com" kind="email" revealable={false} />
    </div>
  ),
}
