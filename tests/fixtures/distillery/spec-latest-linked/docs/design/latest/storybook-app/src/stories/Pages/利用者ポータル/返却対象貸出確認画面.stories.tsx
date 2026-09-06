import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'
import { Button } from '@/components/ui/Button'

/**
 * 返却対象貸出確認画面（/loans/return）。
 * 利用者本人の貸出中・延滞の貸出を返却期限の昇順で一覧表示し、窓口提示対象を特定できるようにする。
 * 各行から利用者番号提示画面（/mypage/card）への副次操作を持つ。
 * 共通コンポーネント: PortalPageLayout / DataListSection（AsyncSection + LoanTable + Pagination）。
 */
const TODAY = '2026-09-02'

interface ReturnableLoan {
  loanId: string
  bookTitle: string
  bookId: string
  dueDate: string
  loanDate: string
  loanStatus: '貸出中' | '延滞'
}

function toLoan(r: ReturnableLoan): Loan {
  return {
    loanId: r.loanId,
    bookTitle: r.bookTitle,
    bookId: r.bookId,
    userNumber: '',
    userName: '',
    loanDate: r.loanDate,
    dueDate: r.dueDate,
    loanPeriodType: '標準',
    state: r.loanStatus,
  }
}

const sampleLoans: ReturnableLoan[] = [
  {
    loanId: 'L-000003',
    bookTitle: '銀河鉄道の夜',
    bookId: 'B-000003',
    dueDate: '2026-08-30',
    loanDate: '2026-08-16',
    loanStatus: '延滞',
  },
  {
    loanId: 'L-000001',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000001',
    dueDate: '2026-09-16',
    loanDate: '2026-09-02',
    loanStatus: '貸出中',
  },
]

interface ScreenProps {
  items: ReturnableLoan[]
  total: number
  loading?: boolean
  error?: string | null
}

const ReturnableLoansScreen: React.FC<ScreenProps> = ({ items, total, loading = false, error = null }) => {
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <PortalPageLayout
      portal="patron"
      title="返却対象を確認"
      description="窓口で提示する返却対象の貸出を確認できます。"
      breadcrumb={[{ label: '貸出', href: '/loans' }, { label: '返却対象を確認' }]}
      width="full"
      activeNavId="loans"
    >
      <DataListSection
        loading={loading}
        error={error}
        isEmpty={!loading && !error && items.length === 0}
        skeleton="table"
        emptyMessage="返却対象の貸出はありません"
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
            loans={items.map(toLoan)}
            showUser={false}
            emptyMessage="返却対象の貸出はありません"
            today={TODAY}
            actionsFor={() => (
              <Button variant="outline" size="sm" iconLeft="id-card">
                窓口で提示する
              </Button>
            )}
          />
        }
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReturnableLoansScreen> = {
  title: 'Pages/利用者ポータル/返却対象貸出確認画面',
  component: ReturnableLoansScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '返却対象貸出確認画面（/loans/return）。貸出中・延滞の貸出を返却期限の昇順で一覧表示する。PortalPageLayout + DataListSection（AsyncSection + LoanTable + Pagination）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReturnableLoansScreen>

export const Default: Story = {
  args: { items: sampleLoans, total: sampleLoans.length },
}

export const Loading: Story = {
  args: { items: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { items: [], total: 0 },
}

export const OverdueFirst: Story = {
  args: { items: sampleLoans, total: sampleLoans.length },
  parameters: {
    docs: {
      description: {
        story: '返却期限を超過した貸出（DueDateIndicator: overdue）が先頭に表示される。',
      },
    },
  },
}

export const ErrorState: Story = {
  args: { items: [], total: 0, error: '通信エラーが発生しました' },
}

export const ManyPages: Story = {
  args: { items: sampleLoans, total: 25 },
  parameters: {
    docs: { description: { story: '21 件以上は Pagination で分割表示する（20 件/頁）。' } },
  },
}
