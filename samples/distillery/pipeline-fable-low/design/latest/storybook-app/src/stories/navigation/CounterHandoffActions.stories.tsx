import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CounterHandoffActions } from '@/components/common/CounterHandoffActions'

const meta: Meta<typeof CounterHandoffActions> = {
  title: 'Common/CounterHandoffActions',
  component: CounterHandoffActions,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof CounterHandoffActions>

export const LoanAndReturn: Story = {
  args: { userNumber: 'U-000123', bookId: 'B-000102', actions: ['loan', 'return'] },
}

export const ReturnOnlyDisabledLoan: Story = {
  args: { userNumber: 'U-000123', bookId: 'B-000102', actions: ['loan', 'return'], disabled: true },
}
