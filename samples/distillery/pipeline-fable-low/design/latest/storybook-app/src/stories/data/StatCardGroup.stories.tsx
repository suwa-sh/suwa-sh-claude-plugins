import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StatCardGroup } from '@/components/common/StatCardGroup'

const meta: Meta<typeof StatCardGroup> = {
  title: 'Common/StatCardGroup',
  component: StatCardGroup,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof StatCardGroup>

const items = [
  { key: 'inStock', label: '在庫あり', value: 120, icon: 'book' as const },
  { key: 'onLoan', label: '貸出中', value: 34, icon: 'book-open' as const },
  { key: 'reserved', label: '予約待ち', value: 8, icon: 'bookmark' as const },
  { key: 'overdue', label: '督促失敗', value: 2, icon: 'alert-triangle' as const, tone: 'destructive' as const },
]

export const Loading: Story = {
  render: () => <StatCardGroup items={items} loading loadingLabel="集計中…" />,
}

export const Content: Story = {
  render: () => <StatCardGroup items={items} loading={false} />,
}

export const Selectable: Story = {
  render: () => {
    const [active, setActive] = useState('inStock')
    return <StatCardGroup items={items} loading={false} activeKey={active} onSelect={setActive} />
  },
}
