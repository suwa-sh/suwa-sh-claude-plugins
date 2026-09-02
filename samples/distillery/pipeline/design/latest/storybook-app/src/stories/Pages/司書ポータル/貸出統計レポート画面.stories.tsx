import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { ReportSummarySection } from '@/components/common/ReportSummarySection'
import { DataListSection } from '@/components/common/DataListSection'
import { Button } from '@/components/ui/Button'
import { Table, type TableColumn } from '@/components/ui/Table'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import type { ReportKpiCardProps } from '@/components/domain/ReportKpiCard'

/**
 * 貸出統計レポート画面（/staff/reports/loans）。
 * UC 固有コンポーネント LoanStatsKpiRow / LoanTrendSection / PopularBookRankingTable /
 * LoanBreakdownPanel を、共通コンポーネント ReportSummarySection（KPI行 → 推移チャート →
 * 明細テーブル）+ DataListSection の薄いアダプタとして実装する。
 * 内訳の軸切り替え（利用者区分／ジャンル）は取得済みデータの再描画のみで API を再取得しない。
 */

interface RankingRow {
  rank: number
  bookId: string
  title: string
  author: string
  genre: string
  loanCount: number
}

const ranking: RankingRow[] = [
  { rank: 1, bookId: 'BK-000001', title: '吾輩は猫である', author: '夏目漱石', genre: '文学', loanCount: 42 },
  { rank: 2, bookId: 'BK-000002', title: '銀河鉄道の夜', author: '宮沢賢治', genre: '文学', loanCount: 35 },
  { rank: 3, bookId: 'BK-000003', title: '遠野物語', author: '柳田国男', genre: '人文', loanCount: 21 },
]

const columns: TableColumn<RankingRow>[] = [
  { key: 'rank', header: '順位', render: (r) => r.rank, mono: true, width: '4rem', align: 'right' },
  { key: 'title', header: 'タイトル', render: (r) => r.title },
  { key: 'author', header: '著者', render: (r) => r.author },
  { key: 'genre', header: 'ジャンル', render: (r) => r.genre, width: '6rem' },
  { key: 'loanCount', header: '貸出回数', render: (r) => `${r.loanCount.toLocaleString('ja-JP')} 件`, mono: true, width: '7rem', align: 'right' },
]

const kpis: ReportKpiCardProps[] = [
  { label: '期間内貸出件数', value: 240, unit: '件', icon: 'book-open', delta: { value: 12, label: '前期比' } },
  { label: '返却済み件数', value: 200, unit: '件', icon: 'check-circle' },
  { label: '利用者数', value: 96, unit: '人', icon: 'users' },
  { label: '1利用者あたり貸出件数', value: 2.5, unit: '件', icon: 'chart-bar' },
]

const userCategoryBreakdown = [
  { label: '一般', value: 140 },
  { label: '学生', value: 80 },
  { label: '団体', value: 20 },
]

const genreBreakdown = [
  { label: '文学', value: 90 },
  { label: '人文', value: 40 },
  { label: '社会科学', value: 30 },
  { label: '自然科学', value: 25 },
  { label: '技術', value: 20 },
  { label: '芸術', value: 15 },
  { label: '児童', value: 15 },
  { label: 'その他', value: 5 },
]

function LoanStatsReportScreen({
  status = '作成済み',
}: {
  status?: '集計中' | '作成済み' | '実績なし'
}) {
  const [page, setPage] = React.useState(1)
  const [axis, setAxis] = React.useState<'利用者区分' | 'ジャンル'>('利用者区分')

  const breakdown = axis === '利用者区分' ? userCategoryBreakdown : genreBreakdown

  return (
    <PortalPageLayout
      portal="staff"
      title="貸出統計レポート"
      breadcrumb={[{ label: '貸出統計レポート' }]}
      activeNavId="analysis"
      width="full"
      actions={
        <Button variant="outline" iconLeft="filter">
          条件を変更する
        </Button>
      }
    >
      <ReportSummarySection
        status={status}
        kpis={kpis}
        chart={{
          data: [
            { label: '8/1週', value: 48 },
            { label: '8/2週', value: 62 },
            { label: '8/3週', value: 55 },
            { label: '8/4週', value: 75 },
          ],
          unit: '件',
        }}
        emptyMessage="対象期間に貸出実績がありません"
        detail={
          <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
              <ToggleGroup
                label="内訳の集計軸"
                mode="single"
                options={[
                  { value: '利用者区分', label: '利用者区分' },
                  { value: 'ジャンル', label: 'ジャンル' },
                ]}
                value={[axis]}
                onChange={(next) => setAxis((next[0] as '利用者区分' | 'ジャンル') ?? '利用者区分')}
              />
              <Table
                columns={[
                  { key: 'label', header: axis, render: (d: { label: string; value: number }) => d.label },
                  {
                    key: 'value',
                    header: '貸出件数',
                    render: (d: { label: string; value: number }) => `${d.value.toLocaleString('ja-JP')} 件`,
                    mono: true,
                    align: 'right',
                  },
                ]}
                rows={breakdown}
                rowKey={(d) => d.label}
                caption={`${axis}別の貸出内訳`}
              />
            </div>
            <DataListSection
              table={
                <Table columns={columns} rows={ranking} rowKey={(r) => r.bookId} caption="人気書籍ランキング" />
              }
              page={page}
              totalPages={1}
              onPageChange={setPage}
              total={ranking.length}
              loading={false}
              error={null}
              isEmpty={ranking.length === 0}
              emptyMessage="対象期間に貸出実績がありません"
            />
          </div>
        }
      />
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/貸出統計レポート画面',
  component: LoanStatsReportScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoanStatsReportScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <LoanStatsReportScreen status="作成済み" />,
}

export const Aggregating: Story = {
  render: () => <LoanStatsReportScreen status="集計中" />,
}

export const NoResult: Story = {
  render: () => <LoanStatsReportScreen status="実績なし" />,
}
