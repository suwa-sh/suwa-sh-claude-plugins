import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { Alert } from '@/components/ui/Feedback'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'
import { formatDateLong } from '@/components/common/dateFormat'

/**
 * 返却完了確認画面（/loans/returned）。
 * 利用者本人の返却済み貸出を返却日の降順で一覧表示し、返却完了サマリ（Alert(success)）と
 * 現在の貸出一覧への導線を提示する（ピーク・エンドの法則）。
 * 共通コンポーネント: PortalPageLayout / DataListSection（AsyncSection + LoanTable + Pagination）。
 */
const TODAY = '2026-09-02'

interface ReturnedLoan {
  loanId: string
  bookTitle: string
  bookId: string
  loanDate: string
  dueDate: string
  returnedAt: string
  overdueDays: number
  loanStatus: 'returned'
}

function toLoan(r: ReturnedLoan): Loan {
  return {
    loanId: r.loanId,
    bookTitle: r.bookTitle,
    bookId: r.bookId,
    userNumber: '',
    userName: '',
    loanDate: r.loanDate,
    dueDate: r.dueDate,
    returnDate: r.returnedAt,
    loanPeriodType: '標準',
    state: '返却済み',
  }
}

const sampleReturned: ReturnedLoan[] = [
  {
    loanId: 'L-000001',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000001',
    loanDate: '2026-08-20',
    dueDate: '2026-09-03',
    returnedAt: '2026-09-10',
    overdueDays: 0,
    loanStatus: 'returned',
  },
  {
    loanId: 'L-000002',
    bookTitle: '坊っちゃん',
    bookId: 'B-000002',
    loanDate: '2026-08-06',
    dueDate: '2026-08-20',
    returnedAt: '2026-08-20',
    overdueDays: 0,
    loanStatus: 'returned',
  },
  {
    loanId: 'L-000003',
    bookTitle: '銀河鉄道の夜',
    bookId: 'B-000003',
    loanDate: '2026-08-16',
    dueDate: '2026-08-30',
    returnedAt: '2026-09-02',
    overdueDays: 3,
    loanStatus: 'returned',
  },
]

interface ScreenProps {
  items: ReturnedLoan[]
  total: number
  loading?: boolean
  error?: string | null
}

const ReturnedLoansScreen: React.FC<ScreenProps> = ({ items, total, loading = false, error = null }) => {
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(total / 20))
  const latest = items[0]?.returnedAt

  return (
    <PortalPageLayout
      portal="patron"
      title="返却完了確認"
      description="返却が完了した貸出を確認できます。"
      breadcrumb={[{ label: '貸出', href: '/loans' }, { label: '返却完了確認' }]}
      width="full"
      activeNavId="loans"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        {!loading && !error && total > 0 && (
          <Alert tone="success" title={`返却が完了しています（${total} 件）`}>
            {latest && `最後の返却: ${formatDateLong(latest)}`}
          </Alert>
        )}
        <DataListSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && items.length === 0}
          skeleton="table"
          emptyMessage="返却済みの貸出はありません"
          emptyAction={
            <a href="/loans" style={{ color: 'var(--primary)' }}>
              現在の貸出一覧を見る
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
              emptyMessage="返却済みの貸出はありません"
              today={TODAY}
            />
          }
        />
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReturnedLoansScreen> = {
  title: 'Pages/利用者ポータル/返却完了確認画面',
  component: ReturnedLoansScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '返却完了確認画面（/loans/returned）。返却済み貸出を返却日の降順で一覧表示し、返却完了サマリと次の行動導線を 1 つ提示する。PortalPageLayout + DataListSection（AsyncSection + LoanTable + Pagination）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReturnedLoansScreen>

export const Default: Story = {
  args: { items: sampleReturned, total: sampleReturned.length },
}

export const Loading: Story = {
  args: { items: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { items: [], total: 0 },
}

export const OverdueReturn: Story = {
  args: { items: [sampleReturned[2]], total: 1 },
  parameters: {
    docs: {
      description: {
        story: '延滞返却は超過日数を事実としてのみ表示し、LoanStatusBadge は neutral の「返却済み」のまま強調しない。',
      },
    },
  },
}

export const ManyPages: Story = {
  args: {
    items: sampleReturned,
    total: 25,
  },
  parameters: {
    docs: {
      description: { story: '21 件以上は Pagination で分割表示する（20 件/頁）。' },
    },
  },
}

export const ErrorState: Story = {
  args: { items: [], total: 0, error: '通信エラーが発生しました' },
}
