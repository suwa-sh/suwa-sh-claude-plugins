import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { ConfirmPage } from '@/components/common/ConfirmPage'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { Alert } from '@/components/ui/Feedback'
import { ReservationTable, NotificationLogTable } from '@/components/domain/LoanTables'
import { PiiMaskedText } from '@/components/domain/PiiMaskedText'
import { sampleBooks, sampleReservations, sampleNotifications } from '@/components/domain/sampleData'
import type { NormalizedApiError } from '@/components/common/types'

const book = sampleBooks[1]
const reservations = sampleReservations.filter((r) => r.book.id === book.id)
const recipient = reservations[0]

const Summary: React.FC = () => (
  <dl className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>書籍</dt>
      <dd>{book.title}</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>送信先（予約順位 {recipient.position} 位）</dt>
      <dd>{recipient.userName}</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>連絡先</dt>
      <dd>
        <PiiMaskedText value="u2@example.com" kind="email" />
      </dd>
    </div>
  </dl>
)

/** 返却通知送信確認画面（/staff/returns/:loanId/notify）。ConfirmPage + supplement（ReservationTable + CollapsibleSection(NotificationLogTable)）。 */
const ReturnNoticeConfirmPage: React.FC<{ blocked?: boolean; submitError?: NormalizedApiError | null; sent?: boolean }> = ({ blocked = false, submitError = null, sent = false }) => {
  const [open, setOpen] = useState(true)
  return (
    <StaffLayout activeGroup="counter" activeItem="returnRegister" userName="佐藤 花子">
      {sent ? (
        <div className="mx-auto w-full" style={{ maxWidth: '40rem', marginBottom: 'var(--spacing-4)' }}>
          <Alert tone="success" title="返却通知を受け付けました" />
        </div>
      ) : null}
      <ConfirmPage
        title="返却通知を送信します"
        tone="primary"
        blocked={blocked}
        summary={<Summary />}
        impact={blocked ? 'この書籍に予約者はいません' : '予約を通知済みにし、返却通知メールを送信します'}
        supplement={
          <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
            <ReservationTable reservations={reservations} showUser />
            <CollapsibleSection title="通知記録" open={open} onToggle={setOpen} count={sampleNotifications.length}>
              <NotificationLogTable logs={sampleNotifications} />
            </CollapsibleSection>
          </div>
        }
        loading={false}
        loadError={null}
        emptyState={{ title: '貸出が見つかりません' }}
        submitting={false}
        submitError={submitError}
        confirmLabel="送信を確定"
        onConfirm={() => {}}
        onCancel={() => {}}
        doneActions={
          sent
            ? [
                { label: '予約状況へ', onClick: () => {} },
                { label: '返却受付へ', onClick: () => {}, variant: 'secondary' },
              ]
            : undefined
        }
      />
    </StaffLayout>
  )
}

const meta: Meta<typeof ReturnNoticeConfirmPage> = {
  title: 'Pages/司書ポータル/返却通知送信確認画面',
  component: ReturnNoticeConfirmPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ReturnNoticeConfirmPage>

export const Default: Story = {
  render: () => <ReturnNoticeConfirmPage />,
}

export const Sent: Story = {
  render: () => <ReturnNoticeConfirmPage blocked sent />,
}

export const Failed: Story = {
  render: () => (
    <ReturnNoticeConfirmPage
      submitError={{ kind: 'business', message: '送信に失敗しました。連絡先を確認してください' }}
    />
  ),
}
