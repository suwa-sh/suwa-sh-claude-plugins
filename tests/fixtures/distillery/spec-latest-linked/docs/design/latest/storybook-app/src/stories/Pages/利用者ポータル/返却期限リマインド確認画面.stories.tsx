import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'

/**
 * 返却期限リマインド確認画面（/loans/due）。返却期限リマインドメールの着地点。
 * MyDueLoanList（LoanTable + DueDateIndicator）+ DueDateNotice（Alert(info) / Alert(warning)）を、
 * 共通コンポーネント AsyncSection の薄いアダプタとして実装する。
 * timing_type クエリで「返却期限が近づいています」/「本日が返却期限です」を出し分ける。
 */

const TODAY = '2026-09-02'

const sampleLoans: Loan[] = [
  {
    loanId: 'L-1001',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000010',
    userNumber: '',
    userName: '',
    loanDate: '2026-08-19',
    dueDate: '2026-09-05',
    loanPeriodType: '標準',
    state: '貸出中',
  },
]

interface ScreenProps {
  timingType: '期限前リマインド' | '期限当日'
  loans: Loan[]
  overdueCount?: number
  loading?: boolean
  error?: string | null
}

function MyDueScreen({ timingType, loans, overdueCount = 0, loading = false, error = null }: ScreenProps) {
  const heading = timingType === '期限当日' ? '本日が返却期限です' : '返却期限が近づいています'

  return (
    <PortalPageLayout
      portal="patron"
      title={heading}
      description="窓口でご返却ください。"
      breadcrumb={[{ label: '貸出', href: '/loans' }, { label: '返却期限の確認' }]}
      width="contained"
      activeNavId="duedate"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <Alert tone="info" title={heading}>
          対象の貸出は窓口でご返却ください。
        </Alert>
        {overdueCount > 0 && (
          <Alert tone="warning" title="返却期限を過ぎた貸出があります">
            延滞返却対象確認画面から超過分をご確認ください。
          </Alert>
        )}
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && loans.length === 0}
          skeleton="table"
          emptyMessage="返却期限が近い貸出はありません"
          emptyAction={
            <Button variant="outline" size="sm" iconLeft="book-open">
              現在の貸出一覧を見る
            </Button>
          }
          onRetry={() => {}}
          readyCount={loans.length}
        >
          <LoanTable
            loans={loans}
            showUser={false}
            today={TODAY}
            emptyMessage="返却期限が近い貸出はありません"
          />
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof MyDueScreen> = {
  title: 'Pages/利用者ポータル/返却期限リマインド確認画面',
  component: MyDueScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '返却期限リマインド確認画面（/loans/due）。ログイン中の利用者本人の期限接近の貸出だけを残日数つきで表示する。timing_type クエリで見出しを出し分ける。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof MyDueScreen>

export const UpcomingReminder: Story = {
  render: () => <MyDueScreen timingType="期限前リマインド" loans={sampleLoans} />,
}

export const DueToday: Story = {
  render: () => (
    <MyDueScreen
      timingType="期限当日"
      loans={sampleLoans.map((l) => ({ ...l, dueDate: TODAY }))}
    />
  ),
}

export const WithOverdueNotice: Story = {
  render: () => <MyDueScreen timingType="期限前リマインド" loans={sampleLoans} overdueCount={1} />,
}

export const Loading: Story = {
  render: () => <MyDueScreen timingType="期限前リマインド" loans={[]} loading />,
}

export const Empty: Story = {
  render: () => <MyDueScreen timingType="期限前リマインド" loans={[]} />,
}
