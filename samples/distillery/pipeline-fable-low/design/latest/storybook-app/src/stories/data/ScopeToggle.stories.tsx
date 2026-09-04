import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ScopeToggle } from '@/components/common/ScopeToggle'

const meta: Meta<typeof ScopeToggle> = {
  title: 'Common/ScopeToggle',
  component: ScopeToggle,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ScopeToggle>

const loanOptions = [
  { value: 'current', label: '現在の貸出' },
  { value: 'history', label: '履歴' },
]

const reservationOptions = [
  { value: 'active', label: '有効な予約のみ' },
  { value: 'all', label: '取消・終了も表示' },
]

export const LoanScope: Story = {
  render: () => {
    const [value, setValue] = useState('current')
    return <ScopeToggle options={loanOptions} value={value} onChange={setValue} ariaLabel="表示範囲" />
  },
}

export const ReservationScopeSmall: Story = {
  render: () => {
    const [value, setValue] = useState('active')
    return <ScopeToggle options={reservationOptions} value={value} onChange={setValue} size="sm" ariaLabel="表示範囲" />
  },
}
