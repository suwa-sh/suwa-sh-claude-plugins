import React from 'react'
import { Button } from '../ui/Button'
import { Card, CardHeader } from '../ui/Card'
import { Input } from '../ui/Input'
import { ToggleGroup } from '../ui/ToggleGroup'
import { aggregationPeriods, reportTypes } from './stateMaps'

export interface ReportPeriodValue {
  reportType: string
  period: string
  from: string
  to: string
}

export interface ReportPeriodSelectorProps {
  value: ReportPeriodValue
  onChange: (next: ReportPeriodValue) => void
  onSubmit: () => void
  submitting?: boolean
}

/** 在庫状況集計条件指定画面・集計期間指定画面の条件入力 */
export const ReportPeriodSelector: React.FC<ReportPeriodSelectorProps> = ({
  value,
  onChange,
  onSubmit,
  submitting = false,
}) => (
  <Card>
    <CardHeader title="集計条件" description="レポート種別と集計期間を指定してください。" />
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      <ToggleGroup
        label="レポート種別"
        mode="single"
        options={reportTypes.map((t) => ({ value: t, label: t }))}
        value={value.reportType ? [value.reportType] : []}
        onChange={(next) => onChange({ ...value, reportType: next[0] ?? '' })}
      />
      <ToggleGroup
        label="集計期間区分"
        mode="single"
        options={aggregationPeriods.map((p) => ({ value: p, label: p }))}
        value={value.period ? [value.period] : []}
        onChange={(next) => onChange({ ...value, period: next[0] ?? '' })}
      />
      <div className="flex flex-wrap items-end" style={{ gap: 'var(--spacing-4)' }}>
        <div className="flex-1 min-w-0">
          <Input
            label="開始日"
            type="date"
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Input
            label="終了日"
            type="date"
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button iconLeft="chart-bar" loading={submitting} onClick={onSubmit}>
          {submitting ? '集計中' : '集計実行'}
        </Button>
      </div>
    </div>
  </Card>
)
