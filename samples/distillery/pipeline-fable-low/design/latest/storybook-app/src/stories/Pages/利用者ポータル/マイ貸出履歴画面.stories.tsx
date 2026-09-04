import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { ScopeToggle } from '@/components/common/ScopeToggle'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { Alert } from '@/components/ui/Feedback'
import { LoanTable } from '@/components/domain/LoanTables'
import { sampleLoans, TODAY } from '@/components/domain/sampleData'
import type { Loan } from '@/components/domain/types'

/** マイ貸出履歴画面（/me/loans）。 */
const MyLoansPage: React.FC<{ loans: Loan[]; overdueCount?: number }> = ({ loans, overdueCount = 0 }) => {
  const [scope, setScope] = useState<'current' | 'history'>('current')
  return (
    <PatronLayout activeNav="myLoans" userName="山田 花子">
      <PageHeader
        title="マイ貸出履歴"
        notices={overdueCount >= 1 ? <Alert tone="warning">返却期限を過ぎた書籍があります。窓口へご返却ください</Alert> : undefined}
      />
      <PaginatedListFrame
        filter={
          <ScopeToggle
            options={[
              { value: 'current', label: '現在の貸出' },
              { value: 'history', label: '履歴' },
            ]}
            value={scope}
            onChange={(v) => setScope(v as 'current' | 'history')}
            ariaLabel="表示範囲"
          />
        }
        page={1}
        totalCount={loans.length}
        onPageChange={() => {}}
        loading={false}
        error={null}
        empty={loans.length === 0}
        emptyState={{ title: scope === 'current' ? '現在借りている書籍はありません' : '貸出履歴はありません', action: { label: '蔵書を検索する', onClick: () => {} } }}
        skeleton={{ variant: 'table' }}
      >
        <LoanTable loans={loans} today={TODAY} variant={scope} showUser={false} />
      </PaginatedListFrame>
    </PatronLayout>
  )
}

const meta: Meta<typeof MyLoansPage> = {
  title: 'Pages/利用者ポータル/マイ貸出履歴画面',
  component: MyLoansPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof MyLoansPage>

export const Default: Story = {
  render: () => <MyLoansPage loans={sampleLoans.filter((l) => l.state === '貸出中')} />,
}

export const WithOverdue: Story = {
  render: () => <MyLoansPage loans={sampleLoans.filter((l) => l.state !== '返却済み')} overdueCount={1} />,
}

export const Empty: Story = {
  render: () => <MyLoansPage loans={[]} />,
}
