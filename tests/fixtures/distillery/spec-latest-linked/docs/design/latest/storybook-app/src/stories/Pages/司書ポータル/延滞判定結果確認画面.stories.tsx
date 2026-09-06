import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Table, type TableColumn } from '@/components/ui/Table'
import { LoanStatusBadge } from '@/components/domain/StatusBadges'
import { formatDateTable } from '@/components/common/dateFormat'

/**
 * 延滞判定結果確認画面（/staff/overdues/judge）。
 * OverdueJudgementSummary（Alert(info) + Card(flush)）+ OverdueJudgedLoanList（LoanTable + LoanStatusBadge）を、
 * 共通コンポーネント AsyncSection + EntityFormSection（mode="action"、判定日の指定）の薄いアダプタとして実装する。
 * 状態遷移の実行は日次タイマーが担うため、本画面から遷移を実行するボタンは置かない。
 */

interface JudgedOverdueLoan {
  loanId: string
  bookTitle: string
  author: string
  userName: string
  dueDate: string
  daysOverdue: number
}

const sampleLoans: JudgedOverdueLoan[] = [
  { loanId: 'L-3001', bookTitle: '坊っちゃん', author: '夏目漱石', userName: '田中太郎', dueDate: '2026-09-01', daysOverdue: 1 },
  { loanId: 'L-3010', bookTitle: 'こころ', author: '夏目漱石', userName: '山本一郎', dueDate: '2026-09-01', daysOverdue: 1 },
]

const columns: TableColumn<JudgedOverdueLoan>[] = [
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
  { key: 'user', header: '利用者', render: (row) => row.userName },
  {
    key: 'dueDate',
    header: '返却期限',
    mono: true,
    render: (row) => formatDateTable(row.dueDate),
  },
  { key: 'daysOverdue', header: '超過日数', mono: true, align: 'right', render: (row) => `${row.daysOverdue} 日` },
  { key: 'state', header: '状態', render: () => <LoanStatusBadge state="延滞" dot /> },
]

interface ScreenProps {
  baseDate: string
  transitionedCount: number
  overdueTotal: number
  loans: JudgedOverdueLoan[]
  loading?: boolean
  error?: string | null
}

function OverdueJudgementScreen({
  baseDate: initialBaseDate,
  transitionedCount,
  overdueTotal,
  loans,
  loading = false,
  error = null,
}: ScreenProps) {
  const [baseDate, setBaseDate] = React.useState(initialBaseDate)

  const fields: FormFieldSpec[] = [
    { key: 'baseDate', label: '判定日', kind: 'text', type: 'date', hint: '既定は当日' },
  ]

  return (
    <PortalPageLayout
      portal="staff"
      title="延滞判定結果確認"
      description="日次タイマーによる延滞判定の結果を確認できます。"
      breadcrumb={[{ label: '期限・督促' }, { label: '延滞判定結果確認' }]}
      width="contained"
      activeNavId="duedate"
      actions={
        <Button variant="default" iconLeft="list">
          延滞状況を確認する
        </Button>
      }
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <Alert tone="info" title={`貸出中 → 延滞 ${transitionedCount} 件（判定日: ${baseDate}）`}>
          判定後の延滞総件数は {overdueTotal} 件です。
        </Alert>
        <Card flush style={{ padding: 'var(--card-padding)' }}>
          <CardHeader title="延滞総数" description={`${overdueTotal} 件`} />
        </Card>
        <EntityFormSection
          title="判定日の指定"
          description="過去日の判定結果を再表示できます。"
          mode="action"
          fields={fields}
          value={{ baseDate }}
          onChange={(_key, v) => setBaseDate(Array.isArray(v) ? v[0] ?? baseDate : v)}
          footer={<Button variant="outline">この日で再表示</Button>}
        />
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && loans.length === 0}
          skeleton="table"
          emptyMessage="新たに延滞となった貸出はありません"
          onRetry={() => {}}
          readyCount={loans.length}
        >
          <Table columns={columns} rows={loans} rowKey={(r) => r.loanId} caption="延滞判定結果一覧" />
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof OverdueJudgementScreen> = {
  title: 'Pages/司書ポータル/延滞判定結果確認画面',
  component: OverdueJudgementScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '延滞判定結果確認画面（/staff/overdues/judge）。日次タイマーによる延滞判定（貸出中 → 延滞）の結果件数と対象一覧を照会専用で表示する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof OverdueJudgementScreen>

export const Default: Story = {
  render: () => (
    <OverdueJudgementScreen baseDate="2026-09-02" transitionedCount={2} overdueTotal={12} loans={sampleLoans} />
  ),
}

export const Empty: Story = {
  render: () => <OverdueJudgementScreen baseDate="2026-09-02" transitionedCount={0} overdueTotal={10} loans={[]} />,
}

export const Loading: Story = {
  render: () => <OverdueJudgementScreen baseDate="2026-09-02" transitionedCount={0} overdueTotal={0} loans={[]} loading />,
}

export const ErrorState: Story = {
  render: () => (
    <OverdueJudgementScreen
      baseDate="2026-09-02"
      transitionedCount={0}
      overdueTotal={0}
      loans={[]}
      error="判定結果を取得できませんでした"
    />
  ),
}
