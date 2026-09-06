import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LoanConfirmation, type LoanResponse } from './LoanConfirmation'

const meta = {
  title: 'Domain/LoanConfirmation',
  component: LoanConfirmation,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LoanConfirmation>

export default meta
type Story = StoryObj<typeof meta>

const result: LoanResponse = {
  loan_id: 'L-000001',
  book_id: 'B-000001',
  user_no: 'U-000123',
  loan_date: '2026-09-02',
  loan_period_type: '標準',
  due_date: '2026-09-16',
  loan_status: '貸出中',
  book_status: '貸出中',
}

export const Default: Story = {
  args: {
    result,
    today: '2026-09-02',
    onLoanSucceeded: () => {},
  },
}

export const NotYetSubmitted: Story = {
  args: {
    result: null,
    onLoanSucceeded: () => {},
  },
}
