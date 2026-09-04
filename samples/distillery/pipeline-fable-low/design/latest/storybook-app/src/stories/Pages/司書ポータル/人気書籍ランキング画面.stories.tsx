import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodReportFrame, type ReportPeriod } from '@/components/common/PeriodReportFrame'
import { RankingList } from '@/components/domain/Reports'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import { sampleRanking } from '@/components/domain/sampleData'

type Limit = '10' | '20' | '50'

interface RankingPageProps {
  loading?: boolean
  empty?: boolean
}

/** 人気書籍ランキング画面（/staff/reports/ranking）。PeriodReportFrame + RankingList + 表示件数 ToggleGroup。 */
const RankingPage: React.FC<RankingPageProps> = ({ loading = false, empty = false }) => {
  const [period, setPeriod] = useState<ReportPeriod>({ granularity: 'MONTH', from: '2025-10-01', to: '2026-09-03' })
  const [limit, setLimit] = useState<Limit>('20')
  const items = empty ? [] : sampleRanking
  const totalLoans = items.reduce((sum, i) => sum + i.count, 0)
  const stats = [
    { key: 'total', label: '期間内貸出件数', value: loading ? null : totalLoans, unit: '件' },
    { key: 'top', label: '1 位の貸出回数', value: loading ? null : items[0]?.count ?? 0, unit: '回' },
  ]
  return (
    <StaffLayout activeGroup="reports" activeItem="ranking" userName="佐藤 花子">
      <PageHeader title="人気書籍ランキング" />
      <PeriodReportFrame
        period={period}
        onPeriodChange={setPeriod}
        stats={stats}
        extraControls={
          <ToggleGroup<Limit>
            label="表示件数"
            size="sm"
            options={[
              { value: '10', label: '10 件' },
              { value: '20', label: '20 件' },
              { value: '50', label: '50 件' },
            ]}
            value={limit}
            onChange={setLimit}
          />
        }
        loading={loading}
        error={null}
        empty={!loading && items.length === 0}
        emptyState={{ title: 'この期間の貸出はありません' }}
      >
        <RankingList items={items} limit={Number(limit)} />
      </PeriodReportFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof RankingPage> = {
  title: 'Pages/司書ポータル/人気書籍ランキング画面',
  component: RankingPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof RankingPage>

export const Default: Story = {
  render: () => <RankingPage />,
}

export const Loading: Story = {
  render: () => <RankingPage loading />,
}

export const Empty: Story = {
  render: () => <RankingPage empty />,
}
