import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PeriodReportFrame, type ReportPeriod } from '@/components/common/PeriodReportFrame'
import { PeriodStatChart } from '@/components/domain/Reports'
import { sampleMonthlySeries } from '@/components/domain/sampleData'

const meta: Meta<typeof PeriodReportFrame> = {
  title: 'Common/PeriodReportFrame',
  component: PeriodReportFrame,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PeriodReportFrame>

const stats = [
  { key: 'total', label: '期間内貸出件数', value: 1802, delta: 8 },
  { key: 'avgDaily', label: '1 日あたり平均', value: 60, unit: '件' },
]

export const Content: Story = {
  render: () => {
    const [period, setPeriod] = useState<ReportPeriod>({ granularity: 'MONTH', from: '2026-04-01', to: '2026-09-03' })
    return (
      <PeriodReportFrame period={period} onPeriodChange={setPeriod} stats={stats} loading={false} error={null} empty={false} emptyState={{ title: '集計対象がありません' }}>
        <PeriodStatChart series={sampleMonthlySeries} granularity="月" />
      </PeriodReportFrame>
    )
  },
}

export const Loading: Story = {
  render: () => {
    const [period, setPeriod] = useState<ReportPeriod>({ granularity: 'MONTH', from: '2026-04-01', to: '2026-09-03' })
    return (
      <PeriodReportFrame period={period} onPeriodChange={setPeriod} stats={stats} loading error={null} empty={false} emptyState={{ title: '集計対象がありません' }}>
        <PeriodStatChart series={[]} granularity="月" loading />
      </PeriodReportFrame>
    )
  },
}

export const MaxRangeError: Story = {
  render: () => {
    const [period, setPeriod] = useState<ReportPeriod>({ granularity: 'DAY', from: '2025-01-01', to: '2026-09-03' })
    return (
      <PeriodReportFrame
        period={period}
        onPeriodChange={setPeriod}
        maxRangeError="日単位では最大 90 日まで指定できます"
        stats={stats}
        loading={false}
        error={null}
        empty={false}
        emptyState={{ title: '集計対象がありません' }}
      >
        <PeriodStatChart series={sampleMonthlySeries} granularity="日" />
      </PeriodReportFrame>
    )
  },
}
