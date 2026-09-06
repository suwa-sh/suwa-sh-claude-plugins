import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DueDateIndicator } from './DueDateIndicator'

const meta = {
  title: 'Domain/DueDateIndicator',
  component: DueDateIndicator,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof DueDateIndicator>

export default meta
type Story = StoryObj<typeof meta>

const TODAY = '2026-05-10'

export const Safe: Story = {
  args: { dueDate: '2026-05-24', today: TODAY, state: '貸出中' },
}

export const Near: Story = {
  args: { dueDate: '2026-05-12', today: TODAY, state: '貸出中' },
}

export const DueToday: Story = {
  args: { dueDate: '2026-05-10', today: TODAY, state: '貸出中' },
}

export const Overdue: Story = {
  args: { dueDate: '2026-05-03', today: TODAY, state: '延滞' },
}

export const Returned: Story = {
  args: { dueDate: '2026-05-03', today: TODAY, state: '返却済み' },
}

export const TableFormat: Story = {
  args: { dueDate: '2026-05-12', today: TODAY, state: '貸出中', dateFormat: 'table', size: 'sm' },
}

export const AllVariants: Story = {
  args: { dueDate: '2026-05-24', today: TODAY, state: '貸出中' },
  render: () => (
    <div className="flex flex-col items-start" style={{ gap: 'var(--spacing-3)' }}>
      <DueDateIndicator dueDate="2026-05-24" today={TODAY} state="貸出中" />
      <DueDateIndicator dueDate="2026-05-12" today={TODAY} state="貸出中" />
      <DueDateIndicator dueDate="2026-05-10" today={TODAY} state="貸出中" />
      <DueDateIndicator dueDate="2026-05-03" today={TODAY} state="延滞" />
      <DueDateIndicator dueDate="2026-05-03" today={TODAY} state="返却済み" />
      <DueDateIndicator dueDate="2026-05-12" today={TODAY} state="貸出中" size="sm" />
    </div>
  ),
}
