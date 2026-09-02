import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { ReportStatusBadge } from '@/components/domain/StatusBadges'
import { aggregationPeriods } from '@/components/domain/stateMaps'

/**
 * 集計期間指定画面（/staff/reports/loans/new）。
 * UC 固有コンポーネント LoanStatsPeriodForm / LoanStatsNoResultNotice を、
 * 共通コンポーネント EntityFormSection（mode="action"）+ SubmitActionButton の
 * 薄いアダプタとして実装する（内部の ReportPeriodSelector 相当）。
 */

interface ConditionValue {
  [key: string]: string
  reportType: string
  periodType: string
  periodStart: string
  periodEnd: string
}

const defaultValue: ConditionValue = {
  reportType: '期間別貸出統計',
  periodType: '月次',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
}

const fields: FormFieldSpec[] = [
  {
    key: 'reportType',
    label: 'レポート種別',
    kind: 'single',
    options: [
      { value: '期間別貸出統計', label: '期間別貸出統計' },
      { value: '人気書籍ランキング', label: '人気書籍ランキング' },
    ],
    required: true,
  },
  {
    key: 'periodType',
    label: '集計期間区分',
    kind: 'single',
    options: aggregationPeriods.map((p) => ({ value: p, label: p })),
    required: true,
  },
  { key: 'periodStart', label: '開始日', kind: 'text', type: 'date', required: true },
  { key: 'periodEnd', label: '終了日', kind: 'text', type: 'date', required: true },
]

function LoanStatsPeriodScreen({
  initialValue = defaultValue,
  recentStatus = '作成済み',
  showNoResultNotice = false,
}: {
  initialValue?: ConditionValue
  recentStatus?: '集計中' | '作成済み' | '実績なし'
  showNoResultNotice?: boolean
}) {
  const [value, setValue] = React.useState<ConditionValue>(initialValue)
  const [submitting, setSubmitting] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
    setFormError(null)
  }

  const onSubmit = () => {
    if (value.periodStart > value.periodEnd) {
      setFormError('集計終了日は集計開始日以降の日付を指定してください')
      return
    }
    setSubmitting(true)
    setTimeout(() => setSubmitting(false), 800)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="集計期間指定"
      breadcrumb={[{ label: '貸出統計レポート', href: '#' }, { label: '集計期間指定' }]}
      activeNavId="analysis"
      width="contained"
    >
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
          直近の集計状態
        </span>
        <ReportStatusBadge state={recentStatus} dot />
      </div>
      {showNoResultNotice && (
        <Alert tone="info" title="実績なし">
          集計期間を変更して再集計してください。
        </Alert>
      )}
      <EntityFormSection
        title="集計条件"
        description="レポート種別と集計期間を指定してください。"
        mode="action"
        fields={fields}
        value={value}
        onChange={onChange}
        formError={formError}
        footer={
          <SubmitActionButton
            idempotencyKey="77777777-7777-4777-8777-777777777777"
            variant="default"
            onSubmit={onSubmit}
            submitting={submitting}
          >
            {submitting ? '集計中' : '集計を実行'}
          </SubmitActionButton>
        }
      />
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/集計期間指定画面',
  component: LoanStatsPeriodScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof LoanStatsPeriodScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <LoanStatsPeriodScreen
      initialValue={{ reportType: '期間別貸出統計', periodType: '月次', periodStart: '2026-08-01', periodEnd: '2026-08-31' }}
    />
  ),
}

export const NoResultNotice: Story = {
  render: () => (
    <LoanStatsPeriodScreen
      initialValue={{ reportType: '期間別貸出統計', periodType: '月次', periodStart: '2026-07-01', periodEnd: '2026-07-31' }}
      recentStatus="実績なし"
      showNoResultNotice
    />
  ),
}

export const ValidationError: Story = {
  render: () => (
    <LoanStatsPeriodScreen
      initialValue={{ reportType: '期間別貸出統計', periodType: '月次', periodStart: '2026-08-31', periodEnd: '2026-08-01' }}
    />
  ),
}
