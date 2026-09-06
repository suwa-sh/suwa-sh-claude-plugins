import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import React from 'react'
import {
  BookStatusBadge,
  LoanStatusBadge,
  ReservationStatusBadge,
  UserStatusBadge,
  NotificationStatusBadge,
  ReportStatusBadge,
} from './StatusBadges'
import {
  bookStates,
  loanStates,
  reservationStates,
  userStates,
  notificationStates,
  reportStates,
} from './stateMaps'

const meta: Meta<typeof BookStatusBadge> = {
  title: 'Domain/StatusBadges',
  component: BookStatusBadge,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof meta>

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="flex flex-col" style={{ gap: 'var(--spacing-2)', minWidth: 0 }}>
    <h3
      style={{
        fontSize: 'var(--font-size-sm)',
        fontWeight: 600,
        color: 'var(--foreground-secondary)',
        margin: 0,
      }}
    >
      {title}
    </h3>
    <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
      {children}
    </div>
  </section>
)

/** RDRA 状態モデル → Badge の対応表。6 モデルの全状態を網羅する。 */
export const AllStates: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)', minWidth: 0 }}>
      <Section title="書籍状態（蔵書管理）">
        {bookStates.map((s) => (
          <BookStatusBadge key={s} state={s} />
        ))}
      </Section>
      <Section title="貸出状態（貸出管理）">
        {loanStates.map((s) => (
          <LoanStatusBadge key={s} state={s} />
        ))}
      </Section>
      <Section title="予約状態（予約管理）">
        {reservationStates.map((s) => (
          <ReservationStatusBadge key={s} state={s} />
        ))}
      </Section>
      <Section title="利用者状態（利用者管理）">
        {userStates.map((s) => (
          <UserStatusBadge key={s} state={s} />
        ))}
      </Section>
      <Section title="通知状態（通知管理）">
        {notificationStates.map((s) => (
          <NotificationStatusBadge key={s} state={s} />
        ))}
      </Section>
      <Section title="統計レポート状態（分析管理）">
        {reportStates.map((s) => (
          <ReportStatusBadge key={s} state={s} />
        ))}
      </Section>
    </div>
  ),
}

/** テーブルの状態列など、色だけに依存させたくない場面のドット併用表示。 */
export const WithDot: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)', minWidth: 0 }}>
      <Section title="書籍状態（dot 併用）">
        {bookStates.map((s) => (
          <BookStatusBadge key={s} state={s} dot />
        ))}
      </Section>
      <Section title="貸出状態（dot 併用）">
        {loanStates.map((s) => (
          <LoanStatusBadge key={s} state={s} dot />
        ))}
      </Section>
    </div>
  ),
}

export const Book: Story = { args: { state: '貸出中' } }
