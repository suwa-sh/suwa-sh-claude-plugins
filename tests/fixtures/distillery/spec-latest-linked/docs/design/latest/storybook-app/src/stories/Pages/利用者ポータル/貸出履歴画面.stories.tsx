import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'
import { Button } from '@/components/ui/Button'

/**
 * 貸出履歴画面（/loans/history）。
 * 返却済みの貸出のみを一覧表示する。現在の貸出との混同を防ぐため、0 件時は
 * 現在の貸出一覧画面（/loans）への導線を明示する。
 * 共通コンポーネント: PortalPageLayout / DataListSection（AsyncSection + LoanTable + Pagination）。
 */
const TODAY = '2026-09-02'

const sampleHistory: Loan[] = [
  {
    loanId: 'L-000010',
    bookTitle: '坊っちゃん',
    bookId: 'B-000002',
    userNumber: '',
    userName: '',
    loanDate: '2026-08-01',
    dueDate: '2026-08-15',
    returnDate: '2026-08-14',
    loanPeriodType: '標準',
    state: '返却済み',
  },
  {
    loanId: 'L-000009',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000001',
    userNumber: '',
    userName: '',
    loanDate: '2026-07-10',
    dueDate: '2026-07-24',
    returnDate: '2026-07-22',
    loanPeriodType: '標準',
    state: '返却済み',
  },
]

interface ScreenProps {
  items: Loan[]
  total: number
  loading?: boolean
  error?: string | null
}

const LoanHistoryScreen: React.FC<ScreenProps> = ({ items, total, loading = false, error = null }) => {
  const [page, setPage] = React.useState(1)
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <PortalPageLayout
      portal="patron"
      title="貸出履歴"
      description="これまでに返却した貸出の履歴です。"
      breadcrumb={[{ label: '貸出履歴' }]}
      width="full"
      activeNavId="history"
      actions={
        <Button variant="outline" size="sm" iconLeft="book-open">
          現在の貸出を見る
        </Button>
      }
    >
      <DataListSection
        loading={loading}
        error={error}
        isEmpty={!loading && !error && items.length === 0}
        skeleton="table"
        emptyMessage="返却済みの貸出はまだありません。現在借りている書籍は「貸出」から確認できます。"
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
            loans={items}
            showUser={false}
            emptyMessage="返却済みの貸出はまだありません"
            today={TODAY}
          />
        }
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof LoanHistoryScreen> = {
  title: 'Pages/利用者ポータル/貸出履歴画面',
  component: LoanHistoryScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '貸出履歴画面（/loans/history）。返却済みの貸出のみを一覧表示する。PortalPageLayout + DataListSection（AsyncSection + LoanTable + Pagination）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof LoanHistoryScreen>

export const Default: Story = {
  args: { items: sampleHistory, total: sampleHistory.length },
}

export const Loading: Story = {
  args: { items: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { items: [], total: 0 },
  parameters: {
    docs: { description: { story: '0 件のとき、現在の貸出との違いを案内し /loans への導線を出す。' } },
  },
}

export const ErrorState: Story = {
  args: { items: [], total: 0, error: '貸出履歴を取得できませんでした' },
}

export const ManyPages: Story = {
  args: { items: sampleHistory, total: 25 },
  parameters: {
    docs: { description: { story: '20 件/頁で分割表示する。Pagination に「1 / 2」が表示される。' } },
  },
}
