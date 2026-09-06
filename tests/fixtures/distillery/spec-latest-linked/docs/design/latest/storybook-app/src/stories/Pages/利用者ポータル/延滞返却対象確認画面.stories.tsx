import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'

/**
 * 延滞返却対象確認画面（/loans/overdue）。督促メールの着地点。
 * MyOverdueLoanList（LoanTable + DueDateIndicator）+ OverdueReturnNotice（Alert(warning)）を、
 * 共通コンポーネント AsyncSection の薄いアダプタとして実装する。
 * 責める文言を避け、事実（超過日数・対象書籍）と次の行動（窓口で返却）のみを示す。
 */

const TODAY = '2026-09-02'

const sampleLoans: Loan[] = [
  {
    loanId: 'L-3001',
    bookTitle: '坊っちゃん',
    bookId: 'B-000001',
    userNumber: '',
    userName: '',
    loanDate: '2026-08-06',
    dueDate: '2026-09-01',
    loanPeriodType: '標準',
    state: '延滞',
  },
]

interface ScreenProps {
  loans: Loan[]
  loading?: boolean
  error?: string | null
}

function MyOverdueScreen({ loans, loading = false, error = null }: ScreenProps) {
  const overdueCount = loans.length

  return (
    <PortalPageLayout
      portal="patron"
      title="延滞返却対象の確認"
      description="返却期限を過ぎた貸出を確認できます。"
      breadcrumb={[{ label: '貸出', href: '/loans' }, { label: '延滞返却対象の確認' }]}
      width="contained"
      activeNavId="duedate"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        {overdueCount > 0 && (
          <Alert tone="warning" title="返却期限を過ぎた本があります。窓口でご返却ください">
            返却対象 {overdueCount} 冊
          </Alert>
        )}
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && loans.length === 0}
          skeleton="table"
          emptyMessage="返却期限を過ぎた貸出はありません"
          emptyAction={
            <Button variant="outline" size="sm" iconLeft="book-open">
              現在の貸出一覧を見る
            </Button>
          }
          onRetry={() => {}}
          readyCount={loans.length}
        >
          <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
            <LoanTable
              loans={loans}
              showUser={false}
              today={TODAY}
              emptyMessage="返却期限を過ぎた貸出はありません"
            />
            <div className="flex justify-end">
              <Button variant="default" iconLeft="arrow-right">
                返却対象を確認する
              </Button>
            </div>
          </div>
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof MyOverdueScreen> = {
  title: 'Pages/利用者ポータル/延滞返却対象確認画面',
  component: MyOverdueScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '延滞返却対象確認画面（/loans/overdue）。ログイン中の利用者本人の延滞中の貸出だけを超過日数つきで表示する。督促メールのリンク先。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof MyOverdueScreen>

export const Default: Story = {
  render: () => <MyOverdueScreen loans={sampleLoans} />,
}

export const Loading: Story = {
  render: () => <MyOverdueScreen loans={[]} loading />,
}

export const Empty: Story = {
  render: () => <MyOverdueScreen loans={[]} />,
}

export const ErrorState: Story = {
  render: () => <MyOverdueScreen loans={[]} error="通信エラーが発生しました" />,
}
