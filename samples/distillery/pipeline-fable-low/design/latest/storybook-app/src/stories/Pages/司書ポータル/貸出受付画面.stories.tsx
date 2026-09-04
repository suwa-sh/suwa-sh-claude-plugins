import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { LoanRegisterPanel, type LoanLookup } from '@/components/domain/CounterPanels'
import { sampleBooks, sampleUsers, TODAY } from '@/components/domain/sampleData'

type Phase = 'input' | 'allowed' | 'denied' | 'done'

/** 貸出受付画面（/staff/loans/new）。LoanRegisterPanel が受付フローを内包するため共通シェルは持たない。 */
const LoanRegisterPage: React.FC<{ phase: Phase; lookup?: LoanLookup }> = ({ phase, lookup }) => (
  <StaffLayout activeGroup="counter" activeItem="loanRegister" userName="佐藤 花子">
    <PageHeader title="貸出受付" />
    <LoanRegisterPanel
      userNumber={lookup?.user?.number ?? ''}
      bookId={lookup?.book?.id ?? ''}
      onUserNumberChange={() => {}}
      onBookIdChange={() => {}}
      onLookup={() => {}}
      lookup={lookup}
      today={TODAY}
      phase={phase}
      submitting={false}
      onConfirm={() => {}}
      onReset={() => {}}
    />
  </StaffLayout>
)

const meta: Meta<typeof LoanRegisterPage> = {
  title: 'Pages/司書ポータル/貸出受付画面',
  component: LoanRegisterPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof LoanRegisterPage>

export const Input: Story = {
  render: () => <LoanRegisterPage phase="input" />,
}

export const Allowed: Story = {
  render: () => (
    <LoanRegisterPage
      phase="allowed"
      lookup={{
        user: sampleUsers[0],
        book: { ...sampleBooks[0], state: '在庫あり' },
        allowed: true,
        dueDate: '2026-09-17',
        loanPeriodDays: 14,
      }}
    />
  ),
}

export const Denied: Story = {
  render: () => (
    <LoanRegisterPage
      phase="denied"
      lookup={{
        user: sampleUsers[0],
        book: sampleBooks[1],
        allowed: false,
        deniedReason: 'この書籍は貸出中です',
      }}
    />
  ),
}

export const Done: Story = {
  render: () => (
    <LoanRegisterPage
      phase="done"
      lookup={{
        user: sampleUsers[0],
        book: sampleBooks[0],
        allowed: true,
        dueDate: '2026-09-17',
        loanPeriodDays: 14,
      }}
    />
  ),
}
