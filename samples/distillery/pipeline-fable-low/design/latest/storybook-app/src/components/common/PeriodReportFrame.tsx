import React from 'react'
import { PeriodSelector } from '@/components/domain/Reports'
import { Alert } from '@/components/ui/Feedback'
import { StatCardGroup, type StatCardGroupItem } from './StatCardGroup'
import { AsyncStateView } from './AsyncStateView'
import type { EmptyStateContent, NormalizedApiError } from './types'

export type ReportGranularity = 'DAY' | 'MONTH' | 'YEAR'

export interface ReportPeriod {
  granularity: ReportGranularity
  from: string
  to: string
}

export interface PeriodReportFrameProps {
  period: ReportPeriod
  onPeriodChange: (period: ReportPeriod) => void
  maxRangeError?: string
  stats: StatCardGroupItem[]
  /** 表示件数の ScopeToggle（S-ランキング） */
  extraControls?: React.ReactNode
  loading: boolean
  error: NormalizedApiError | null
  empty: boolean
  emptyState: EmptyStateContent
  onRetry?: () => void
  children: React.ReactNode
}

const granularityToJa: Record<ReportGranularity, '日' | '月' | '年'> = { DAY: '日', MONTH: '月', YEAR: '年' }
const granularityToEn: Record<'日' | '月' | '年', ReportGranularity> = { 日: 'DAY', 月: 'MONTH', 年: 'YEAR' }

/**
 * PeriodSelector を上部に置き、granularity / from / to を分析 3 画面間で引き継ぐ。
 * 集計中は StatCardGroup とチャート領域を Skeleton にし「集計中…」を出す。
 */
export const PeriodReportFrame: React.FC<PeriodReportFrameProps> = ({ period, onPeriodChange, maxRangeError, stats, extraControls, loading, error, empty, emptyState, onRetry, children }) => (
  <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
    <div className="flex flex-wrap items-end justify-between" style={{ gap: 'var(--spacing-3)' }}>
      <PeriodSelector
        value={{ granularity: granularityToJa[period.granularity], from: period.from, to: period.to }}
        onChange={(v) => onPeriodChange({ granularity: granularityToEn[v.granularity], from: v.from, to: v.to })}
      />
      {extraControls ?? null}
    </div>
    {maxRangeError ? <Alert tone="warning">{maxRangeError}</Alert> : null}
    <StatCardGroup items={stats} loading={loading} loadingLabel="集計中…" />
    <AsyncStateView loading={loading} error={error} empty={empty} skeleton={{ variant: 'card', count: 3 }} emptyState={emptyState} onRetry={onRetry} loadingLabel="集計中…">
      {children}
    </AsyncStateView>
  </div>
)
