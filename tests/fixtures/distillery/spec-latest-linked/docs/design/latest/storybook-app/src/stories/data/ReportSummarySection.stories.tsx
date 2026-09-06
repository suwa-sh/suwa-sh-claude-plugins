import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ReportSummarySection } from '@/components/common/ReportSummarySection'
import { Table } from '@/components/ui/Table'

const meta: Meta<typeof ReportSummarySection> = {
  title: 'Common/ReportSummarySection',
  component: ReportSummarySection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '「KPI 行 → 推移チャート → 明細テーブル」の情報階層とレポート状態の表現を統一する（ReportKpiCard + LoanTrendChart + ReportStatusBadge + Table + EmptyState の合成）。KPI は 1 行 4 件までにする。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReportSummarySection>

const detailRows = [
  { genre: '文学', total: 120, onLoan: 34 },
  { genre: '自然科学', total: 88, onLoan: 21 },
]

export const Created: Story = {
  args: {
    status: '作成済み',
    kpis: [
      { label: '総冊数', value: 1240, unit: '冊' },
      { label: '貸出中', value: 312, unit: '冊' },
      { label: '予約待ち', value: 45, unit: '冊' },
      { label: '在庫あり', value: 883, unit: '冊', delta: { value: 3, label: '前期比' } },
    ],
    chart: { data: [{ label: '4月', value: 120 }, { label: '5月', value: 145 }, { label: '6月', value: 132 }], unit: '冊' },
    detail: (
      <Table
        caption="ジャンル別明細"
        rowKey={(r) => r.genre}
        rows={detailRows}
        columns={[
          { key: 'genre', header: 'ジャンル', render: (r) => r.genre },
          { key: 'total', header: '総冊数', align: 'right', mono: true, render: (r) => r.total },
          { key: 'onLoan', header: '貸出中', align: 'right', mono: true, render: (r) => r.onLoan },
        ]}
      />
    ),
  },
}

export const Analyzing: Story = {
  args: { status: '集計中', kpis: [], detail: null },
}

export const NoResults: Story = {
  args: { status: '実績なし', kpis: [], detail: null, emptyMessage: '対象期間に貸出実績がありません' },
}
