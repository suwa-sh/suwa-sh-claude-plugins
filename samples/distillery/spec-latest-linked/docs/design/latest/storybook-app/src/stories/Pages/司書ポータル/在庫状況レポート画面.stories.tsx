import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { ReportSummarySection } from '@/components/common/ReportSummarySection'
import { DataListSection } from '@/components/common/DataListSection'
import { Button } from '@/components/ui/Button'
import { Table, type TableColumn } from '@/components/ui/Table'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import type { ReportKpiCardProps } from '@/components/domain/ReportKpiCard'
import type { BookState } from '@/components/domain/stateMaps'

/**
 * 在庫状況レポート画面（/staff/reports/inventory）。
 * UC 固有コンポーネント InventoryKpiRow / InventoryStatusChart / InventoryBookTable を、
 * 共通コンポーネント ReportSummarySection（KPI行 → 推移チャート → 明細テーブル）+
 * DataListSection の薄いアダプタとして実装する。
 */

interface InventoryBookRow {
  bookId: string
  title: string
  author: string
  genre: string
  bookStatus: BookState
}

const rows: InventoryBookRow[] = [
  { bookId: 'BK-000001', title: '吾輩は猫である', author: '夏目漱石', genre: '文学', bookStatus: '在庫あり' },
  { bookId: 'BK-000002', title: '銀河鉄道の夜', author: '宮沢賢治', genre: '文学', bookStatus: '貸出中' },
  { bookId: 'BK-000003', title: '坊っちゃん', author: '夏目漱石', genre: '文学', bookStatus: '予約待ち' },
]

const columns: TableColumn<InventoryBookRow>[] = [
  { key: 'bookId', header: '書籍ID', render: (r) => r.bookId, mono: true, width: '9rem' },
  { key: 'title', header: 'タイトル', render: (r) => r.title },
  { key: 'author', header: '著者', render: (r) => r.author },
  { key: 'genre', header: 'ジャンル', render: (r) => r.genre, width: '6rem' },
  { key: 'bookStatus', header: '書籍状態', render: (r) => <BookStatusBadge state={r.bookStatus} dot />, width: '8rem' },
]

const kpis: ReportKpiCardProps[] = [
  { label: '蔵書総数', value: 120, unit: '件', icon: 'library', delta: { value: 4, label: '前回集計比' } },
  { label: '在庫あり', value: 80, unit: '件', icon: 'check-circle', tone: 'success', delta: { value: 2, label: '前回集計比' } },
  { label: '貸出中', value: 30, unit: '件', icon: 'book-open', tone: 'default', delta: { value: -1, label: '前回集計比' } },
  { label: '稼働率', value: 25.0, unit: '%', icon: 'chart-pie', tone: 'default' },
]

function InventoryReportScreen({
  status = '作成済み',
}: {
  status?: '集計中' | '作成済み' | '実績なし'
}) {
  const [page, setPage] = React.useState(1)
  const [statusFilter, setStatusFilter] = React.useState<BookState | null>(null)

  const filteredRows = statusFilter ? rows.filter((r) => r.bookStatus === statusFilter) : rows

  return (
    <PortalPageLayout
      portal="staff"
      title="在庫状況レポート"
      breadcrumb={[{ label: '在庫状況レポート' }]}
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
            { label: '在庫あり', value: 80 },
            { label: '貸出中', value: 30 },
            { label: '予約待ち', value: 10 },
          ],
          unit: '件',
        }}
        emptyMessage="集計期間を変更して再集計してください"
        detail={
          <DataListSection
            table={
              <Table
                columns={columns}
                rows={filteredRows}
                rowKey={(r) => r.bookId}
                caption="書籍状態別の蔵書一覧"
              />
            }
            page={page}
            totalPages={1}
            onPageChange={setPage}
            total={filteredRows.length}
            loading={false}
            error={null}
            isEmpty={filteredRows.length === 0}
            emptyMessage="該当する書籍がありません"
          />
        }
      />
      {status === '作成済み' && (
        <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            区分で絞り込む:
          </span>
          {(['在庫あり', '貸出中', '予約待ち'] as BookState[]).map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? 'default' : 'outline'}
              size="sm"
              onClick={() => setStatusFilter(statusFilter === s ? null : s)}
            >
              {s}
            </Button>
          ))}
        </div>
      )}
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/在庫状況レポート画面',
  component: InventoryReportScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InventoryReportScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <InventoryReportScreen status="作成済み" />,
}

export const Aggregating: Story = {
  render: () => <InventoryReportScreen status="集計中" />,
}

export const NoResult: Story = {
  render: () => <InventoryReportScreen status="実績なし" />,
}
