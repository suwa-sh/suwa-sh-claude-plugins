import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LoanTable } from './LoanTable'
import type { Loan } from './LoanTable'
import { Button } from '../ui/Button'

const meta = {
  title: 'Domain/LoanTable',
  component: LoanTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LoanTable>

export default meta
type Story = StoryObj<typeof meta>

const TODAY = '2026-05-10'

const loans: Loan[] = [
  {
    loanId: 'LN-2026-000181',
    bookTitle: '夜明けの図書室',
    bookId: 'BK-000412',
    userNumber: 'U-100238',
    userName: '芦田 悠里',
    loanDate: '2026-04-28',
    dueDate: '2026-05-24',
    loanPeriodType: '長期',
    state: '貸出中',
  },
  {
    loanId: 'LN-2026-000194',
    bookTitle: '統計思考の教室',
    bookId: 'BK-001077',
    userNumber: 'U-100511',
    userName: '棚橋 千尋',
    loanDate: '2026-05-01',
    dueDate: '2026-05-12',
    loanPeriodType: '標準',
    state: '貸出中',
  },
  {
    loanId: 'LN-2026-000203',
    bookTitle: '瀬戸内の民具と暮らし',
    bookId: 'BK-000689',
    userNumber: 'U-100742',
    userName: '槇原 令子',
    loanDate: '2026-04-12',
    dueDate: '2026-05-03',
    loanPeriodType: '標準',
    state: '延滞',
  },
  {
    loanId: 'LN-2026-000155',
    bookTitle: '光と影の建築史',
    bookId: 'BK-000238',
    userNumber: 'U-100238',
    userName: '芦田 悠里',
    loanDate: '2026-03-20',
    dueDate: '2026-04-10',
    returnDate: '2026-04-08',
    loanPeriodType: '短期',
    state: '返却済み',
  },
]

export const Default: Story = {
  args: { loans, today: TODAY },
}

export const WithUserColumn: Story = {
  args: {
    loans,
    today: TODAY,
    showUser: true,
    onSelect: () => {},
    actionsFor: (loan) => (
      <Button variant="outline" size="sm" aria-label={`${loan.bookTitle} を返却処理する`}>
        返却処理
      </Button>
    ),
  },
}

export const Overdue: Story = {
  args: {
    loans: loans.filter((l) => l.state === '延滞'),
    today: TODAY,
    showUser: true,
    actionsFor: () => (
      <Button variant="outline" size="sm">
        督促
      </Button>
    ),
  },
}

export const Loading: Story = {
  args: { loans: [], today: TODAY, loading: true, showUser: true },
}

export const Empty: Story = {
  args: { loans: [], today: TODAY, emptyMessage: '現在貸出中の書籍はありません' },
}

export const Error: Story = {
  args: {
    loans: [],
    today: TODAY,
    error: '貸出サービスに接続できません。時間をおいて再度お試しください。',
  },
}
