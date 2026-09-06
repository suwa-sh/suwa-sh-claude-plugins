import React from 'react'
import { ReportKpiCard, type ReportKpiCardProps } from '@/components/domain/ReportKpiCard'
import { LoanTrendChart, type LoanTrendDatum } from '@/components/domain/LoanTrendChart'
import { ReportStatusBadge } from '@/components/domain/StatusBadges'
import { Skeleton } from '@/components/ui/Feedback'
import { EmptyState } from '@/components/ui/Feedback'

export interface ReportSummarySectionProps {
  status: '集計中' | '作成済み' | '実績なし'
  /** ReportKpiCard の props 配列。4 件以内 */
  kpis: ReportKpiCardProps[]
  chart?: { data: LoanTrendDatum[]; unit?: string }
  detail: React.ReactNode
  emptyMessage?: string
}

/**
 * 「KPI 行 → 推移チャート → 明細テーブル」の情報階層と、
 * レポート状態（集計中 / 作成済み / 実績なし）の表現を統一する。
 */
export const ReportSummarySection: React.FC<ReportSummarySectionProps> = ({
  status,
  kpis,
  chart,
  detail,
  emptyMessage = '対象期間の実績データがありません',
}) => {
  if (status === '実績なし') {
    return (
      <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
        <ReportStatusBadge state="実績なし" />
        <EmptyState icon="chart-bar" title="実績なし" description={emptyMessage} />
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <ReportStatusBadge state={status} />
      {status === '集計中' ? (
        <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
          <Skeleton height="6rem" />
          <Skeleton height="12rem" />
        </div>
      ) : (
        <>
          <div
            className="grid"
            style={{ gridTemplateColumns: `repeat(${Math.min(kpis.length, 4)}, minmax(0, 1fr))`, gap: 'var(--component-gap)' }}
          >
            {kpis.slice(0, 4).map((k) => (
              <ReportKpiCard key={k.label} {...k} />
            ))}
          </div>
          {chart && <LoanTrendChart data={chart.data} unit={chart.unit} highlightMax />}
          {detail}
        </>
      )}
    </div>
  )
}
