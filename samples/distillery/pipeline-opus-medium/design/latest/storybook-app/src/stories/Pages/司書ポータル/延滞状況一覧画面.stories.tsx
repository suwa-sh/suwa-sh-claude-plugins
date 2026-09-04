import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Card, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Table, type TableColumn } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { DueDateIndicator } from '@/components/domain/DueDateIndicator'
import { LoanStatusBadge, NotificationStatusBadge } from '@/components/domain/StatusBadges'
import type { NotificationState } from '@/components/domain/stateMaps'

/**
 * 延滞状況一覧画面（/staff/overdues）。
 * OverdueLoanList（LoanTable + DueDateIndicator + LoanStatusBadge + NotificationStatusBadge の合成）
 * + OverdueSummary（Card(flush) + Alert(destructive)）を、
 * 共通コンポーネント DataListSection（AsyncSection + FilterPanel + Pagination）の薄いアダプタとして実装する。
 * 照会専用画面のため一覧に送信ボタンは置かない。
 */

const TODAY = '2026-09-02'

interface OverdueLoan {
  loanId: string
  bookTitle: string
  author: string
  userNumber: string
  userName: string
  userCategory: string
  dueDate: string
  daysOverdue: number
  lastDunStatus: NotificationState | '未送信'
}

const sampleLoans: OverdueLoan[] = [
  {
    loanId: 'L-3001',
    bookTitle: '坊っちゃん',
    author: '夏目漱石',
    userNumber: 'U-000123',
    userName: '田中太郎',
    userCategory: '一般',
    dueDate: '2026-08-20',
    daysOverdue: 13,
    lastDunStatus: '送信済み',
  },
  {
    loanId: 'L-3002',
    bookTitle: '銀河鉄道の夜',
    author: '宮沢賢治',
    userNumber: 'U-000456',
    userName: '鈴木花子',
    userCategory: '学生',
    dueDate: '2026-08-30',
    daysOverdue: 3,
    lastDunStatus: '送信失敗',
  },
  {
    loanId: 'L-3003',
    bookTitle: '走れメロス',
    author: '太宰治',
    userNumber: 'U-000789',
    userName: '佐々木次郎',
    userCategory: '一般',
    dueDate: '2026-08-31',
    daysOverdue: 2,
    lastDunStatus: '未送信',
  },
]

function overdueColumns(): TableColumn<OverdueLoan>[] {
  return [
    {
      key: 'book',
      header: '書籍',
      render: (row) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span style={{ color: 'var(--foreground)' }}>{row.bookTitle}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            {row.author}
          </span>
        </div>
      ),
    },
    {
      key: 'user',
      header: '利用者',
      render: (row) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span style={{ color: 'var(--foreground)' }}>{row.userName}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            {row.userCategory} / {row.userNumber}
          </span>
        </div>
      ),
    },
    {
      key: 'dueDate',
      header: '返却期限',
      width: '14rem',
      render: (row) => (
        <DueDateIndicator dueDate={row.dueDate} today={TODAY} state="延滞" size="sm" dateFormat="table" />
      ),
    },
    {
      key: 'state',
      header: '状態',
      width: '7rem',
      render: () => <LoanStatusBadge state="延滞" dot />,
    },
    {
      key: 'dun',
      header: '督促状況',
      width: '9rem',
      render: (row) =>
        row.lastDunStatus === '未送信' ? (
          <Badge variant="neutral">未送信</Badge>
        ) : (
          <NotificationStatusBadge state={row.lastDunStatus} dot />
        ),
    },
  ]
}

const sortFields = (sort: string): FilterFieldSpec[] => [
  {
    key: 'sort',
    label: '並び替え',
    kind: 'single',
    options: [
      { value: 'days_overdue_desc', label: '超過日数の降順（既定）' },
      { value: 'days_overdue_asc', label: '超過日数の昇順' },
    ],
    value: sort,
  },
]

interface ScreenProps {
  loans: OverdueLoan[]
  loading?: boolean
  error?: string | null
}

function OverdueListScreen({ loans, loading = false, error = null }: ScreenProps) {
  const [sort, setSort] = React.useState('days_overdue_desc')
  const [page, setPage] = React.useState(1)

  const sorted = React.useMemo(() => {
    const list = [...loans]
    list.sort((a, b) => (sort === 'days_overdue_desc' ? b.daysOverdue - a.daysOverdue : a.daysOverdue - b.daysOverdue))
    return list
  }, [loans, sort])

  const dunFailed = loans.filter((l) => l.lastDunStatus === '送信失敗').length
  const dunNotSent = loans.filter((l) => l.lastDunStatus === '未送信').length

  return (
    <PortalPageLayout
      portal="staff"
      title="延滞状況一覧"
      description="延滞中の貸出を超過日数の降順で確認できます。"
      breadcrumb={[{ label: '期限・督促' }, { label: '延滞状況一覧' }]}
      width="full"
      activeNavId="duedate"
      actions={
        <Button variant="default" iconLeft="mail-warning">
          督促を送信する
        </Button>
      }
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <Card flush style={{ padding: 'var(--card-padding)' }}>
          <CardHeader
            title="延滞サマリ"
            description={`延滞総件数 ${loans.length} 件 / 督促未送信 ${dunNotSent} 件 / 督促未達 ${dunFailed} 件`}
          />
        </Card>
        {dunFailed > 0 && (
          <Alert tone="destructive" title={`督促未達 ${dunFailed} 件`}>
            督促メールが届いていない貸出があります。督促送信画面から再送してください。
          </Alert>
        )}
        <FilterPanel
          fields={sortFields(sort)}
          onChange={(_key, value) => setSort(Array.isArray(value) ? value[0] ?? sort : value)}
          onSubmit={() => {}}
          resultCount={loans.length}
          collapsedByDefault={false}
        />
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && sorted.length === 0}
          skeleton="table"
          emptyMessage="延滞中の貸出はありません"
          onRetry={() => {}}
          readyCount={sorted.length}
        >
          <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
            <Table columns={overdueColumns()} rows={sorted} rowKey={(r) => r.loanId} caption="延滞状況一覧" />
            <Pagination page={page} totalPages={1} onChange={setPage} totalCount={sorted.length} pageSize={20} />
          </div>
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof OverdueListScreen> = {
  title: 'Pages/司書ポータル/延滞状況一覧画面',
  component: OverdueListScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '延滞状況一覧画面（/staff/overdues）。超過日数の降順を既定ソートにし、督促の実施状況を行に併記する。督促の送信・再送は督促送信画面で行う照会専用画面。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof OverdueListScreen>

export const Default: Story = {
  render: () => <OverdueListScreen loans={sampleLoans} />,
}

export const WithDunFailures: Story = {
  render: () => <OverdueListScreen loans={sampleLoans} />,
  parameters: {
    docs: { description: { story: '督促未達が 1 件以上のとき Alert(destructive) で警告する。' } },
  },
}

export const Loading: Story = {
  render: () => <OverdueListScreen loans={[]} loading />,
}

export const Empty: Story = {
  render: () => <OverdueListScreen loans={[]} />,
}

export const ErrorState: Story = {
  render: () => <OverdueListScreen loans={[]} error="延滞情報を取得できませんでした" />,
}
