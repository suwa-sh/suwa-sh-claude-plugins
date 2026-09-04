import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { StatCardGroup, type StatCardGroupItem } from '@/components/common/StatCardGroup'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { OverdueTable, NotificationLogTable, type OverdueRow } from '@/components/domain/LoanTables'
import { sampleBooks, sampleNotifications, TODAY } from '@/components/domain/sampleData'

const overdueRows: OverdueRow[] = [
  {
    id: 'L-001990',
    book: sampleBooks[0],
    userNumber: 'U-000124',
    userName: '佐藤 太郎',
    loanedAt: '2026-08-10',
    dueDate: '2026-08-24',
    state: '延滞',
    lastReminderAt: '2026-09-03T06:00:00',
    lastReminderResult: '成功',
    reminderCount: 2,
  },
  {
    id: 'L-001988',
    book: sampleBooks[4],
    userNumber: 'U-000125',
    userName: '鈴木 一郎',
    loanedAt: '2026-08-05',
    dueDate: '2026-08-19',
    state: '延滞',
    lastReminderAt: '2026-08-30T14:05:00',
    lastReminderResult: '失敗',
    reminderCount: 1,
  },
]

export interface OverduesPageProps {
  rows: OverdueRow[]
  loading?: boolean
}

/** 延滞・督促状況画面。StatCardGroup + OverdueTable + 行展開の NotificationLogTable を構成する。 */
const OverduesPage: React.FC<OverduesPageProps> = ({ rows, loading = false }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const items: StatCardGroupItem[] = [
    { key: 'overdue', label: '延滞件数', value: rows.length, unit: '件' },
    { key: 'failed', label: '督促失敗', value: rows.filter((r) => r.lastReminderResult === '失敗').length, tone: 'destructive' },
    { key: 'pending', label: '督促待ち', value: 0 },
  ]
  return (
    <StaffLayout activeGroup="reservations" activeItem="overdues">
      <PageHeader title="延滞・督促状況" />
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <StatCardGroup items={items} loading={loading} />
        <PaginatedListFrame
          page={1}
          totalCount={rows.length}
          onPageChange={() => {}}
          loading={loading}
          error={null}
          empty={rows.length === 0}
          emptyState={{ title: '延滞中の貸出はありません', description: '日次バッチが返却期限超過を判定すると、ここに表示されます' }}
          skeleton={{ variant: 'table' }}
        >
          <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
            <OverdueTable rows={rows} today={TODAY} />
            {rows.map((row) => (
              <CollapsibleSection
                key={row.id}
                title={`${row.userName} の通知記録`}
                open={expandedId === row.id}
                onToggle={(open) => setExpandedId(open ? row.id : null)}
                count={row.reminderCount}
              >
                <NotificationLogTable logs={sampleNotifications} />
              </CollapsibleSection>
            ))}
          </div>
        </PaginatedListFrame>
      </div>
    </StaffLayout>
  )
}

const meta: Meta<typeof OverduesPage> = {
  title: 'Pages/司書ポータル/延滞・督促状況画面',
  component: OverduesPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof OverduesPage>

export const Default: Story = {
  render: () => <OverduesPage rows={overdueRows} />,
}

export const Empty: Story = {
  render: () => <OverduesPage rows={[]} />,
}

export const Loading: Story = {
  render: () => <OverduesPage rows={[]} loading />,
}
