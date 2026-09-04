import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PeriodReportFrame, type ReportPeriod } from '@/components/common/PeriodReportFrame'
import { PeriodStatChart } from '@/components/domain/Reports'
import { sampleMonthlySeries } from '@/components/domain/sampleData'

const sampleDailySeries = [
  { label: '08/28', value: 42 },
  { label: '08/29', value: 38 },
  { label: '08/30', value: 51 },
  { label: '08/31', value: 47 },
  { label: '09/01', value: 60 },
  { label: '09/02', value: 55 },
  { label: '09/03', value: 12 },
]

interface LoanStatisticsPageProps {
  initialGranularity: 'MONTH' | 'DAY'
  loading?: boolean
}

/** 期間別貸出統計画面（/staff/reports/loans）。PeriodReportFrame + PeriodStatChart で集計値と推移を表示する。 */
const LoanStatisticsPage: React.FC<LoanStatisticsPageProps> = ({ initialGranularity, loading = false }) => {
  const [period, setPeriod] = useState<ReportPeriod>(
    initialGranularity === 'MONTH'
      ? { granularity: 'MONTH', from: '2025-10-01', to: '2026-09-03' }
      : { granularity: 'DAY', from: '2026-08-28', to: '2026-09-03' }
  )
  const series = period.granularity === 'MONTH' ? sampleMonthlySeries : sampleDailySeries
  const total = series.reduce((sum, s) => sum + s.value, 0)
  const avg = Math.round((total / series.length) * 10) / 10
  const stats = [
    { key: 'total', label: '期間内貸出件数', value: loading ? null : total, unit: '件', delta: 8 },
    { key: 'avg', label: '1 期間あたり平均', value: loading ? null : avg, unit: '件' },
  ]
  return (
    <StaffLayout activeGroup="reports" activeItem="loanStats" userName="佐藤 花子">
      <PageHeader title="期間別貸出統計" />
      <PeriodReportFrame
        period={period}
        onPeriodChange={setPeriod}
        stats={stats}
        loading={loading}
        error={null}
        empty={false}
        emptyState={{ title: 'この期間の貸出はありません' }}
      >
        <PeriodStatChart series={series} granularity={period.granularity === 'MONTH' ? '月' : '日'} loading={loading} />
      </PeriodReportFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof LoanStatisticsPage> = {
  title: 'Pages/司書ポータル/期間別貸出統計画面',
  component: LoanStatisticsPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof LoanStatisticsPage>

export const Monthly: Story = {
  render: () => <LoanStatisticsPage initialGranularity="MONTH" />,
}

export const Daily: Story = {
  render: () => <LoanStatisticsPage initialGranularity="DAY" />,
}

export const Loading: Story = {
  render: () => <LoanStatisticsPage initialGranularity="MONTH" loading />,
}
