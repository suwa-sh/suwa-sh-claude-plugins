import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { Table, type TableColumn } from '@/components/ui/Table'
import { EmptyState } from '@/components/ui/Feedback'
import { ReservationStatusBadge } from '@/components/domain/StatusBadges'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import type { ReservationState } from '@/components/domain/stateMaps'
import { formatDateTable } from '@/components/common/dateFormat'

/**
 * 予約状況一覧画面（/reservations）。
 * 本人の予約を状態バッジ・予約順位つきのテーブルで一覧表示する。行の展開で
 * ReservationQueueTracker（予約中 → 取置き中 → 貸出済み）を表示する。
 * 共通コンポーネント: PortalPageLayout / DataListSection（AsyncSection + Table + Pagination）。
 */
const TODAY = '2026-09-02'

interface ReservationItem {
  reservationId: string
  bookTitle: string
  bookAuthor: string
  bookGenre: string
  bookMaterialType: string
  reservationStatus: ReservationState
  priority?: number
  totalReservations?: number
  appliedAt: string
  holdExpiresAt?: string
}

const sampleReservations: ReservationItem[] = [
  {
    reservationId: 'R-0001',
    bookTitle: '吾輩は猫である',
    bookAuthor: '夏目漱石',
    bookGenre: '文学',
    bookMaterialType: '紙書籍',
    reservationStatus: '予約中',
    priority: 1,
    totalReservations: 3,
    appliedAt: '2026-08-25T09:00:00+09:00',
  },
  {
    reservationId: 'R-0002',
    bookTitle: '銀河鉄道の夜',
    bookAuthor: '宮沢賢治',
    bookGenre: '文学',
    bookMaterialType: '電子書籍',
    reservationStatus: '取置き中',
    priority: 1,
    totalReservations: 1,
    appliedAt: '2026-08-10T14:00:00+09:00',
    holdExpiresAt: '2026-09-05T23:59:00+09:00',
  },
  {
    reservationId: 'R-0003',
    bookTitle: '坊っちゃん',
    bookAuthor: '夏目漱石',
    bookGenre: '文学',
    bookMaterialType: '紙書籍',
    reservationStatus: 'キャンセル',
    appliedAt: '2026-07-20T11:00:00+09:00',
  },
]

interface ScreenProps {
  items: ReservationItem[]
  total: number
  loading?: boolean
  error?: string | null
}

const ReservationListScreen: React.FC<ScreenProps> = ({ items, total, loading = false, error = null }) => {
  const [page, setPage] = React.useState(1)
  const [expandedId, setExpandedId] = React.useState<string | null>(null)
  const totalPages = Math.max(1, Math.ceil(total / 20))

  const columns: TableColumn<ReservationItem>[] = [
    {
      key: 'book',
      header: '書籍',
      render: (row) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <button
            type="button"
            onClick={() => setExpandedId(expandedId === row.reservationId ? null : row.reservationId)}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              color: 'var(--primary)',
              cursor: 'pointer',
              textAlign: 'left',
              fontSize: 'var(--font-size-sm)',
            }}
            aria-expanded={expandedId === row.reservationId}
          >
            {row.bookTitle}
          </button>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            {row.bookAuthor}
          </span>
        </div>
      ),
    },
    { key: 'genre', header: 'ジャンル', width: '7rem', render: (row) => row.bookGenre },
    { key: 'materialType', header: '資料種別', width: '7rem', render: (row) => row.bookMaterialType },
    {
      key: 'status',
      header: '予約状態',
      width: '8rem',
      render: (row) => <ReservationStatusBadge state={row.reservationStatus} dot />,
    },
    {
      key: 'priority',
      header: '予約順位',
      width: '8rem',
      mono: true,
      render: (row) =>
        row.reservationStatus === '予約中' && row.priority !== undefined
          ? `${row.totalReservations ?? row.priority} 人中 ${row.priority} 番目`
          : '—',
    },
    {
      key: 'appliedAt',
      header: '申込日時',
      width: '8rem',
      mono: true,
      render: (row) => formatDateTable(row.appliedAt),
    },
  ]

  const expanded = items.find((i) => i.reservationId === expandedId)

  return (
    <PortalPageLayout
      portal="patron"
      title="予約状況"
      description="申し込んでいる予約の状況を確認できます。"
      breadcrumb={[{ label: '予約状況' }]}
      width="full"
      activeNavId="reservations"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <DataListSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && items.length === 0}
          skeleton="table"
          emptyMessage="予約はありません"
          emptyAction={
            <a href="/search" style={{ color: 'var(--primary)' }}>
              蔵書を検索する
            </a>
          }
          onRetry={() => {}}
          total={total}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          table={
            <Table
              caption="予約一覧"
              columns={columns}
              rows={items}
              rowKey={(r) => r.reservationId}
              empty={<EmptyState icon="bookmark" title="予約はありません" />}
            />
          }
        />
        {expanded && (
          <ReservationQueueTracker
            bookTitle={expanded.bookTitle}
            state={expanded.reservationStatus}
            rank={expanded.priority}
            totalReservations={expanded.totalReservations}
            holdDeadline={expanded.holdExpiresAt}
            today={TODAY}
          />
        )}
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReservationListScreen> = {
  title: 'Pages/利用者ポータル/予約状況一覧画面',
  component: ReservationListScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '予約状況一覧画面（/reservations）。予約状態バッジ・予約順位つきのテーブルで一覧表示し、行の展開で ReservationQueueTracker を表示する。PortalPageLayout + DataListSection（AsyncSection + Table + Pagination）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReservationListScreen>

export const Default: Story = {
  args: { items: sampleReservations, total: sampleReservations.length },
}

export const Loading: Story = {
  args: { items: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { items: [], total: 0 },
}

export const ErrorState: Story = {
  args: { items: [], total: 0, error: '予約情報を取得できませんでした' },
}

export const ManyPages: Story = {
  args: { items: sampleReservations, total: 25 },
  parameters: {
    docs: { description: { story: '21 件以上は Pagination で分割表示する（20 件/頁）。' } },
  },
}
