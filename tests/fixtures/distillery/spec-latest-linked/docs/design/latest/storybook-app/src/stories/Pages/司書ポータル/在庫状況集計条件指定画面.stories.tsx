import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { ReportStatusBadge } from '@/components/domain/StatusBadges'
import { aggregationPeriods } from '@/components/domain/stateMaps'

/**
 * 在庫状況集計条件指定画面（/staff/reports/inventory/new）。
 * UC 固有コンポーネント InventoryReportConditionForm / InventoryReportStatusIndicator を、
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
  reportType: '在庫状況',
  periodType: '月次',
  periodStart: '2026-08-01',
  periodEnd: '2026-08-31',
}

const fields: FormFieldSpec[] = [
  { key: 'reportType', label: 'レポート種別', kind: 'single', options: [{ value: '在庫状況', label: '在庫状況' }], required: true },
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

function InventoryReportConditionScreen({
  initialValue = defaultValue,
  recentStatus = '作成済み',
}: {
  initialValue?: ConditionValue
  recentStatus?: '集計中' | '作成済み' | '実績なし'
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
      title="在庫状況集計条件指定"
      breadcrumb={[{ label: '在庫状況レポート', href: '#' }, { label: '集計条件指定' }]}
      activeNavId="analysis"
      width="contained"
    >
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
          直近の集計状態
        </span>
        <ReportStatusBadge state={recentStatus} dot />
      </div>
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
            idempotencyKey="55555555-5555-4555-8555-555555555555"
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
  title: 'Pages/司書ポータル/在庫状況集計条件指定画面',
  component: InventoryReportConditionScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof InventoryReportConditionScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <InventoryReportConditionScreen
      initialValue={{ reportType: '在庫状況', periodType: '月次', periodStart: '2026-08-01', periodEnd: '2026-08-31' }}
    />
  ),
}

export const ValidationError: Story = {
  render: () => (
    <InventoryReportConditionScreen
      initialValue={{ reportType: '在庫状況', periodType: '月次', periodStart: '2026-08-31', periodEnd: '2026-08-01' }}
    />
  ),
}

export const Submitting: Story = {
  render: () => (
    <InventoryReportConditionScreen
      initialValue={{ reportType: '在庫状況', periodType: '月次', periodStart: '2026-08-01', periodEnd: '2026-08-31' }}
      recentStatus="集計中"
    />
  ),
}
