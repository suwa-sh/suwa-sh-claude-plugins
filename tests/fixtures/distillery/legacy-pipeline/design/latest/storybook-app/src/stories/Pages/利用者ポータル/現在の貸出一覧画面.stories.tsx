import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'

/**
 * 現在の貸出一覧画面（/loans）。
 * 利用者本人の貸出中・延滞の貸出を LoanTable で一覧表示する。showUser は常に false。
 * 共通コンポーネント: PortalPageLayout / DataListSection（AsyncSection + LoanTable + Pagination）。
 */
const TODAY = '2026-09-02'

const sampleLoans: Loan[] = [
  {
    loanId: 'L-000001',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000001',
    userNumber: '',
    userName: '',
    loanDate: '2026-09-02',
    dueDate: '2026-09-16',
    loanPeriodType: '標準',
    state: '貸出中',
  },
  {
    loanId: 'L-000003',
    bookTitle: '銀河鉄道の夜',
    bookId: 'B-000003',
    userNumber: '',
    userName: '',
    loanDate: '2026-08-16',
    dueDate: '2026-08-30',
    loanPeriodType: '標準',
    state: '延滞',
  },
]

interface ScreenProps {
  items: Loan[]
  total: number
  loading?: boolean
  error?: string | null
}

const CurrentLoansScreen: React.FC<ScreenProps> = ({ items, total, loading = false, error = null }) => {
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <PortalPageLayout
      portal="patron"
      title="現在の貸出"
      description="いま借りている書籍の一覧です。"
      breadcrumb={[{ label: '貸出' }]}
      width="full"
      activeNavId="loans"
    >
      <DataListSection
        loading={loading}
        error={error}
        isEmpty={!loading && !error && items.length === 0}
        skeleton="table"
        emptyMessage="現在借りている書籍はありません"
        emptyAction={
          <a href="/search" style={{ color: 'var(--primary)' }}>
            蔵書を検索する
          </a>
        }
        onRetry={() => {}}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        table={
          <LoanTable
            loans={items}
            showUser={false}
            emptyMessage="現在借りている書籍はありません"
            today={TODAY}
            onSelect={() => {}}
          />
        }
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof CurrentLoansScreen> = {
  title: 'Pages/利用者ポータル/現在の貸出一覧画面',
  component: CurrentLoansScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '現在の貸出一覧画面（/loans）。貸出中・延滞の貸出を一覧表示する。他利用者の貸出への導線は持たない（LP-025）。PortalPageLayout + DataListSection（AsyncSection + LoanTable + Pagination）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof CurrentLoansScreen>

export const Default: Story = {
  args: { items: sampleLoans, total: sampleLoans.length },
}

export const Loading: Story = {
  args: { items: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { items: [], total: 0 },
}

export const Overdue: Story = {
  args: { items: [sampleLoans[1]], total: 1 },
  parameters: {
    docs: { description: { story: '延滞は DueDateIndicator(overdue)「3日超過」と LoanStatusBadge「延滞」で示す。' } },
  },
}

export const ErrorState: Story = {
  args: { items: [], total: 0, error: '貸出情報を取得できませんでした' },
}

export const ManyPages: Story = {
  args: { items: sampleLoans, total: 25 },
  parameters: {
    docs: { description: { story: '21 件以上は Pagination で分割表示する（20 件/頁）。' } },
  },
}
