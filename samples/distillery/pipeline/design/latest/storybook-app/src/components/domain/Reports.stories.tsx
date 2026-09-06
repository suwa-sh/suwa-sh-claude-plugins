import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PeriodSelector, PeriodStatChart, RankingList, StatCard, type PeriodValue } from './Reports'
import { sampleMonthlySeries, sampleRanking } from './sampleData'

const meta: Meta = {
  title: 'Domain/Reports',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const StatCards: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 16 }}>
      <StatCard label="今月の貸出件数" value={436} unit="件" delta={35} icon="book-open" />
      <StatCard label="延滞中" value={3} unit="件" delta={-2} icon="alert-triangle" tone="destructive" />
      <StatCard label="予約待ち" value={7} unit="件" icon="bookmark" />
      <StatCard label="集計中" value={0} loading icon="chart-bar" />
    </div>
  ),
}
export const Period: Story = {
  render: function Render() {
    const [v, setV] = useState<PeriodValue>({ granularity: '月', from: '2026-04-01', to: '2026-09-03' })
    return <PeriodSelector value={v} onChange={setV} />
  },
}
export const Ranking: Story = { render: () => <div style={{ maxWidth: 640 }}><RankingList items={sampleRanking} /></div> }
export const RankingLoading: Story = { render: () => <RankingList items={[]} loading /> }
export const RankingEmpty: Story = { render: () => <RankingList items={[]} /> }
export const Chart: Story = { render: () => <div style={{ maxWidth: 720 }}><PeriodStatChart series={sampleMonthlySeries} granularity="月" /></div> }
export const ChartDaily: Story = {
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <PeriodStatChart granularity="日" series={Array.from({ length: 14 }).map((_, i) => ({ label: `8/${i + 20 > 31 ? i - 11 : i + 20}`, value: [12, 18, 9, 22, 15, 4, 3, 17, 21, 19, 8, 14, 5, 2][i] }))} />
    </div>
  ),
}
export const ChartLoading: Story = { render: () => <PeriodStatChart series={[]} granularity="月" loading /> }
