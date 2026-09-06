import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LoanTable, NotificationLogTable, OverdueTable, ReservationTable } from './LoanTables'
import { ConfirmPanel, LoanRegisterPanel, ReturnRegisterPanel } from './CounterPanels'
import { BookStatusBadge } from './StatusBadges'
import { sampleBooks, sampleLoans, sampleNotifications, sampleReservations, sampleUsers, TODAY } from './sampleData'

const meta: Meta = {
  title: 'Domain/Loans',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const LoanTableCurrent: Story = { render: () => <LoanTable loans={sampleLoans.filter((l) => l.state !== '返却済み')} today={TODAY} /> }
export const LoanTableHistory: Story = { render: () => <LoanTable loans={sampleLoans} today={TODAY} variant="history" showUser /> }
export const LoanTableEmpty: Story = { render: () => <LoanTable loans={[]} today={TODAY} /> }

export const Overdue: Story = {
  render: () => (
    <OverdueTable
      today={TODAY}
      rows={[
        { ...sampleLoans[2], lastReminderAt: '2026-09-03T06:00:00', lastReminderResult: '成功', reminderCount: 3 },
        { ...sampleLoans[2], id: 'L-001991', book: sampleBooks[5], userNumber: 'U-000125', userName: '鈴木 一郎', dueDate: '2026-08-30', lastReminderAt: '2026-09-01T06:00:00', lastReminderResult: '失敗', reminderCount: 1 },
        { ...sampleLoans[2], id: 'L-001992', book: sampleBooks[3], userNumber: 'U-000124', userName: '佐藤 太郎', dueDate: '2026-09-02' },
      ]}
      onOpenUser={() => undefined}
    />
  ),
}
export const Notifications: Story = { render: () => <NotificationLogTable logs={sampleNotifications} /> }
export const Reservations: Story = { render: () => <ReservationTable reservations={sampleReservations.slice(0, 2)} showUser /> }
export const ReservationsMine: Story = { render: () => <ReservationTable reservations={sampleReservations.filter((r) => r.userNumber === 'U-000123')} onCancel={() => undefined} /> }

export const LoanRegisterInteractive: Story = {
  render: function Render() {
    const [userNumber, setU] = useState('U-000123')
    const [bookId, setB] = useState('B-000101')
    const [phase, setPhase] = useState<'input' | 'allowed' | 'denied' | 'done'>('input')
    const [submitting, setSubmitting] = useState(false)
    const user = sampleUsers.find((u) => u.number === userNumber)
    const book = sampleBooks.find((b) => b.id === bookId)
    const allowed = !!user && !!book && book.state === '在庫あり'
    return (
      <LoanRegisterPanel
        userNumber={userNumber}
        bookId={bookId}
        onUserNumberChange={setU}
        onBookIdChange={setB}
        onLookup={() => setPhase(allowed ? 'allowed' : 'denied')}
        lookup={{ user, book, allowed, deniedReason: !user ? '利用者番号が見つかりません' : !book ? '書籍 ID が見つかりません' : `この書籍は${book.state}です`, dueDate: '2026-09-17', loanPeriodDays: 14 }}
        today={TODAY}
        phase={phase}
        submitting={submitting}
        onConfirm={() => {
          setSubmitting(true)
          setTimeout(() => {
            setSubmitting(false)
            setPhase('done')
          }, 800)
        }}
        onReset={() => {
          setPhase('input')
          setU('')
          setB('')
        }}
      />
    )
  },
}
export const LoanRegisterDenied: Story = {
  render: () => (
    <LoanRegisterPanel userNumber="U-000123" bookId="B-000102" onUserNumberChange={() => undefined} onBookIdChange={() => undefined} onLookup={() => undefined} lookup={{ user: sampleUsers[0], book: sampleBooks[1], allowed: false, deniedReason: 'この書籍は貸出中です。予約を案内してください' }} today={TODAY} phase="denied" onConfirm={() => undefined} onReset={() => undefined} />
  ),
}
export const LoanRegisterDone: Story = {
  render: () => (
    <LoanRegisterPanel userNumber="U-000123" bookId="B-000101" onUserNumberChange={() => undefined} onBookIdChange={() => undefined} onLookup={() => undefined} lookup={{ user: sampleUsers[0], book: sampleBooks[0], allowed: true, dueDate: '2026-09-17', loanPeriodDays: 14 }} today={TODAY} phase="done" onConfirm={() => undefined} onReset={() => undefined} />
  ),
}
export const ReturnRegisterWithReservation: Story = {
  render: () => (
    <ReturnRegisterPanel bookId="B-000102" onBookIdChange={() => undefined} onLookup={() => undefined} lookup={{ loan: sampleLoans[0], book: sampleBooks[1], nextBookState: '予約待ち', firstReservation: sampleReservations[0] }} today={TODAY} phase="found-with-reservation" onConfirm={() => undefined} onReset={() => undefined} />
  ),
}
export const ReturnRegisterDone: Story = {
  render: () => (
    <ReturnRegisterPanel bookId="B-000102" onBookIdChange={() => undefined} onLookup={() => undefined} lookup={{ loan: sampleLoans[0], book: sampleBooks[1], nextBookState: '予約待ち', firstReservation: sampleReservations[0] }} today={TODAY} phase="done" onConfirm={() => undefined} onReset={() => undefined} onNotify={() => undefined} />
  ),
}
export const ConfirmDelete: Story = {
  render: () => (
    <ConfirmPanel
      tone="destructive"
      title="書籍を削除しますか"
      description="蔵書一覧から除外されます。この操作は取り消せません"
      summary={[
        { label: '書籍 ID', value: <code>{sampleBooks[0].id}</code> },
        { label: 'タイトル', value: sampleBooks[0].title },
        { label: '状態', value: <BookStatusBadge state="在庫あり" /> },
      ]}
      impact="削除後は検索結果に表示されなくなります"
      confirmLabel="削除する"
    />
  ),
}
export const ConfirmBlocked: Story = {
  render: () => (
    <ConfirmPanel
      tone="destructive"
      title="書籍を削除しますか"
      summary={[
        { label: '書籍 ID', value: <code>{sampleBooks[1].id}</code> },
        { label: 'タイトル', value: sampleBooks[1].title },
        { label: '状態', value: <BookStatusBadge state="貸出中" /> },
      ]}
      blocked
      blockedReason="貸出中・予約待ちの書籍は削除できません。返却後に再度お試しください"
    />
  ),
}
export const ConfirmSendNotification: Story = {
  render: () => (
    <ConfirmPanel
      title="返却通知を送信しますか"
      description="予約順位 1 位の利用者へメール配信サービス経由で送信します"
      summary={[
        { label: '書籍', value: sampleBooks[1].title },
        { label: '送信先', value: '佐藤 太郎 (U-000124)' },
        { label: '通知種別', value: '返却通知' },
      ]}
      impact="送信後、予約の状態は「通知済み」になります"
      confirmLabel="送信する"
      submitting
    />
  ),
}
