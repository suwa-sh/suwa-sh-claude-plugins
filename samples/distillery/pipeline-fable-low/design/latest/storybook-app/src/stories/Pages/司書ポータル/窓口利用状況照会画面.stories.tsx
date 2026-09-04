import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { KeywordSearchInput } from '@/components/common/KeywordSearchInput'
import { AsyncStateView } from '@/components/common/AsyncStateView'
import { ScopeToggle } from '@/components/common/ScopeToggle'
import { StatCardGroup } from '@/components/common/StatCardGroup'
import { CounterHandoffActions } from '@/components/common/CounterHandoffActions'
import { Card } from '@/components/ui/Card'
import { PiiMaskedText } from '@/components/domain/PiiMaskedText'
import { LoanTable, ReservationTable } from '@/components/domain/LoanTables'
import { sampleLoans, sampleReservations, sampleUsers, TODAY } from '@/components/domain/sampleData'

const user = sampleUsers[0]
const loans = sampleLoans.filter((l) => l.userNumber === user.number && l.state !== '返却済み')
const reservations = sampleReservations.filter((r) => r.userNumber === user.number && r.state !== '取消')
const overdueCount = loans.filter((l) => l.state === '延滞').length

/** 窓口利用状況照会画面（/staff/users/:userId/status）。 */
const UserUsagePage: React.FC<{ notFound?: boolean; userNumberInput?: string }> = ({ notFound = false, userNumberInput = user.number }) => {
  const [loanScope, setLoanScope] = useState<'current' | 'history'>('current')
  const [includeClosedReservations, setIncludeClosedReservations] = useState('false')
  return (
    <StaffLayout activeGroup="counter" activeItem="userStatus" userName="佐藤 花子">
      <PageHeader
        title="窓口利用状況照会"
        subtitle={notFound ? undefined : user.number}
        primaryAction={notFound ? undefined : { label: overdueCount >= 1 ? '返却受付へ' : '貸出受付へ', onClick: () => {} }}
      />
      <div className="flex flex-col" style={{ gap: 'var(--component-gap)', marginBottom: 'var(--section-gap)' }}>
        <KeywordSearchInput value={userNumberInput} onChange={() => {}} onSubmit={() => {}} placeholder="利用者番号で照会" autoFocus />
      </div>
      <AsyncStateView
        loading={false}
        error={null}
        empty={notFound}
        skeleton={{ variant: 'card' }}
        emptyState={{ title: `利用者番号 ${userNumberInput} は登録されていません` }}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          <Card>
            <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--foreground-secondary)' }}>利用者番号</span>
                <span style={{ fontFamily: 'var(--font-family-mono)' }}>{user.number}</span>
              </div>
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--foreground-secondary)' }}>氏名</span>
                <span>{user.name}</span>
              </div>
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--foreground-secondary)' }}>メールアドレス</span>
                <PiiMaskedText value={user.email} kind="email" />
              </div>
              <div className="flex items-center justify-between" style={{ fontSize: 'var(--font-size-sm)' }}>
                <span style={{ color: 'var(--foreground-secondary)' }}>電話番号</span>
                <PiiMaskedText value={user.phone} kind="phone" />
              </div>
            </div>
          </Card>
          <StatCardGroup
            loading={false}
            items={[
              { key: 'onLoan', label: '貸出中', value: loans.filter((l) => l.state !== '延滞').length },
              { key: 'overdue', label: '延滞', value: overdueCount, tone: 'destructive' },
              { key: 'reservation', label: '予約中', value: reservations.length },
            ]}
          />
          <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <ScopeToggle
              options={[
                { value: 'current', label: '現在の貸出' },
                { value: 'history', label: '履歴' },
              ]}
              value={loanScope}
              onChange={(v) => setLoanScope(v as 'current' | 'history')}
              size="sm"
              ariaLabel="貸出の表示範囲"
            />
            <LoanTable loans={loans} today={TODAY} variant={loanScope} showUser={false} />
          </div>
          <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <ScopeToggle
              options={[
                { value: 'false', label: '有効な予約のみ' },
                { value: 'true', label: '取消・終了も表示' },
              ]}
              value={includeClosedReservations}
              onChange={setIncludeClosedReservations}
              size="sm"
              ariaLabel="予約の表示範囲"
            />
            <ReservationTable reservations={reservations} showUser={false} />
          </div>
          <CounterHandoffActions actions={['loan', 'return']} userNumber={user.number} />
        </div>
      </AsyncStateView>
    </StaffLayout>
  )
}

const meta: Meta<typeof UserUsagePage> = {
  title: 'Pages/司書ポータル/窓口利用状況照会画面',
  component: UserUsagePage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UserUsagePage>

export const Default: Story = {
  render: () => <UserUsagePage />,
}

export const NotFound: Story = {
  render: () => <UserUsagePage notFound userNumberInput="U-999999" />,
}
