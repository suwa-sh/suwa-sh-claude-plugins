import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Table, type TableColumn } from '@/components/ui/Table'
import { Pagination } from '@/components/ui/Pagination'
import { DueDateIndicator } from '@/components/domain/DueDateIndicator'
import { formatDateTable, formatDateTimeLong } from '@/components/common/dateFormat'

/**
 * 返却期限接近貸出一覧画面（/staff/duedates/upcoming）。
 * UpcomingDueLoanList（LoanTable + DueDateIndicator）+ DueTimingFilter（ToggleGroup）を、
 * 共通コンポーネント DataListSection（AsyncSection + FilterPanel + Pagination）の薄いアダプタとして実装する。
 */

const TODAY = '2026-09-02'

interface UpcomingDueLoan {
  loanId: string
  bookTitle: string
  author: string
  userNumber: string
  userName: string
  loanDate: string
  dueDate: string
}

const sampleLoans: UpcomingDueLoan[] = [
  {
    loanId: 'L-1001',
    bookTitle: '吾輩は猫である',
    author: '夏目漱石',
    userNumber: 'U-000111',
    userName: '田中太郎',
    loanDate: '2026-08-19',
    dueDate: '2026-09-05',
  },
  {
    loanId: 'L-1002',
    bookTitle: 'こころ',
    author: '夏目漱石',
    userNumber: 'U-000222',
    userName: '山本一郎',
    loanDate: '2026-08-20',
    dueDate: '2026-09-02',
  },
]

const columns: TableColumn<UpcomingDueLoan>[] = [
  {
    key: 'book',
    header: '書籍',
    render: (row) => (
      <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
        <span style={{ color: 'var(--foreground)' }}>{row.bookTitle}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>{row.author}</span>
      </div>
    ),
  },
  {
    key: 'user',
    header: '利用者',
    render: (row) => (
      <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
        <span style={{ color: 'var(--foreground)' }}>{row.userName}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>{row.userNumber}</span>
      </div>
    ),
  },
  {
    key: 'loanDate',
    header: '貸出日',
    mono: true,
    render: (row) => formatDateTable(row.loanDate),
  },
  {
    key: 'dueDate',
    header: '返却期限',
    width: '14rem',
    render: (row) => (
      <DueDateIndicator dueDate={row.dueDate} today={TODAY} state="貸出中" size="sm" dateFormat="table" />
    ),
  },
]

interface ScreenProps {
  loans: UpcomingDueLoan[]
  evaluatedAt: string
  loading?: boolean
  error?: string | null
}

function UpcomingDueScreen({ loans, evaluatedAt, loading = false, error = null }: ScreenProps) {
  const [timingType, setTimingType] = React.useState('期限前リマインド')
  const [page, setPage] = React.useState(1)

  const fields: FilterFieldSpec[] = [
    {
      key: 'timingType',
      label: '通知タイミング区分',
      kind: 'single',
      options: [
        { value: '期限前リマインド', label: '期限前リマインド' },
        { value: '期限当日', label: '期限当日' },
      ],
      value: timingType,
    },
  ]

  const evaluatedLabel = formatDateTimeLong(evaluatedAt)

  return (
    <PortalPageLayout
      portal="staff"
      title="返却期限接近貸出一覧"
      description="日次バッチの判定結果を確認できます。"
      breadcrumb={[{ label: '期限・督促' }, { label: '返却期限接近貸出一覧' }]}
      width="full"
      activeNavId="duedate"
      actions={
        <Button variant="default" iconLeft="mail">
          リマインドを送信する
        </Button>
      }
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <Alert tone="info" title={`日次バッチの判定結果です（判定日時: ${evaluatedLabel}）`} />
        <FilterPanel
          fields={fields}
          onChange={(_key, value) => setTimingType(Array.isArray(value) ? value[0] ?? timingType : value)}
          onSubmit={() => {}}
          resultCount={loans.length}
          collapsedByDefault={false}
        />
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && loans.length === 0}
          skeleton="table"
          emptyMessage="対象の貸出はありません"
          onRetry={() => {}}
          readyCount={loans.length}
        >
          <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
            <Table columns={columns} rows={loans} rowKey={(r) => r.loanId} caption="返却期限接近貸出一覧" />
            <Pagination page={page} totalPages={1} onChange={setPage} totalCount={loans.length} pageSize={20} />
          </div>
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof UpcomingDueScreen> = {
  title: 'Pages/司書ポータル/返却期限接近貸出一覧画面',
  component: UpcomingDueScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '返却期限接近貸出一覧画面（/staff/duedates/upcoming）。通知タイミング区分（期限前リマインド / 期限当日）で絞り込み、残日数つきで対象貸出を一覧表示する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof UpcomingDueScreen>

export const Default: Story = {
  render: () => <UpcomingDueScreen loans={sampleLoans} evaluatedAt="2026-09-02T01:10:00+09:00" />,
}

export const DueToday: Story = {
  render: () => (
    <UpcomingDueScreen
      loans={[{ ...sampleLoans[1], dueDate: TODAY }]}
      evaluatedAt="2026-09-02T01:10:00+09:00"
    />
  ),
}

export const Loading: Story = {
  render: () => <UpcomingDueScreen loans={[]} evaluatedAt="2026-09-02T01:10:00+09:00" loading />,
}

export const Empty: Story = {
  render: () => <UpcomingDueScreen loans={[]} evaluatedAt="2026-09-02T01:10:00+09:00" />,
}

export const ErrorState: Story = {
  render: () => (
    <UpcomingDueScreen loans={[]} evaluatedAt="2026-09-02T01:10:00+09:00" error="一覧を取得できませんでした" />
  ),
}
