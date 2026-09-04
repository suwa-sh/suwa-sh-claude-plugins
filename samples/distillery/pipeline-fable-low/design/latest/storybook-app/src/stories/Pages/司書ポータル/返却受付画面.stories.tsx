import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { ReturnRegisterPanel, type ReturnLookup } from '@/components/domain/CounterPanels'
import { sampleBooks, sampleLoans, sampleReservations, TODAY } from '@/components/domain/sampleData'

type Phase = 'input' | 'found' | 'found-with-reservation' | 'done'

/** 返却受付画面（/staff/returns/new）。ReturnRegisterPanel が受付フローを内包するため共通シェルは持たない。 */
const ReturnRegisterPage: React.FC<{ phase: Phase; lookup?: ReturnLookup }> = ({ phase, lookup }) => (
  <StaffLayout activeGroup="counter" activeItem="returnRegister" userName="佐藤 花子">
    <PageHeader title="返却受付" />
    <ReturnRegisterPanel
      bookId={lookup?.book?.id ?? ''}
      onBookIdChange={() => {}}
      onLookup={() => {}}
      lookup={lookup}
      today={TODAY}
      phase={phase}
      submitting={false}
      onConfirm={() => {}}
      onReset={() => {}}
      onNotify={() => {}}
    />
  </StaffLayout>
)

const meta: Meta<typeof ReturnRegisterPage> = {
  title: 'Pages/司書ポータル/返却受付画面',
  component: ReturnRegisterPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof ReturnRegisterPage>

export const Input: Story = {
  render: () => <ReturnRegisterPage phase="input" />,
}

export const Found: Story = {
  render: () => (
    <ReturnRegisterPage
      phase="found"
      lookup={{
        loan: sampleLoans[0],
        book: sampleBooks[1],
        nextBookState: '在庫あり',
      }}
    />
  ),
}

export const FoundWithReservation: Story = {
  render: () => (
    <ReturnRegisterPage
      phase="found-with-reservation"
      lookup={{
        loan: sampleLoans[0],
        book: sampleBooks[1],
        nextBookState: '予約待ち',
        firstReservation: sampleReservations[0],
      }}
    />
  ),
}

export const Done: Story = {
  render: () => (
    <ReturnRegisterPage
      phase="done"
      lookup={{
        loan: sampleLoans[0],
        book: sampleBooks[1],
        nextBookState: '予約待ち',
        firstReservation: sampleReservations[0],
      }}
    />
  ),
}
