import React from 'react'
import { EmptyState } from '../ui/Feedback'

export interface LoanTrendDatum {
  label: string
  value: number
}

export interface LoanTrendChartProps {
  data: LoanTrendDatum[]
  unit?: string
  /** 最大値のバーだけ強調し、他を muted 色にする */
  highlightMax?: boolean
  emptyMessage?: string
}

const GRID_LINES = 4

/**
 * 期間別貸出統計の棒グラフ。外部ライブラリを使わず div のみで描画する。
 * 色だけに依存しないよう、各バーに数値ラベルを付け aria-label でも内容を伝える。
 */
export const LoanTrendChart: React.FC<LoanTrendChartProps> = ({
  data,
  unit = '件',
  highlightMax = false,
  emptyMessage = '対象期間の貸出実績がありません。集計条件を変えてお試しください。',
}) => {
  if (data.length === 0) {
    return <EmptyState icon="chart-bar" title="表示できるデータがありません" description={emptyMessage} />
  }

  const max = Math.max(...data.map((d) => d.value), 1)
  const summary = data
    .map((d) => `${d.label} ${d.value.toLocaleString('ja-JP')}${unit}`)
    .join('、')

  return (
    <div
      role="img"
      aria-label={`期間別貸出統計の棒グラフ。${summary}。最大値は ${max.toLocaleString('ja-JP')}${unit}。`}
      className="flex flex-col"
      style={{ gap: 'var(--spacing-3)', width: '100%' }}
    >
      <div className="flex" style={{ gap: 'var(--spacing-3)' }}>
        {/* 縦軸ラベル */}
        <div
          className="flex flex-col justify-between items-end"
          style={{
            height: '16rem',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--chart-axis-label)',
            fontFamily: 'var(--font-family-mono)',
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
          aria-hidden="true"
        >
          {Array.from({ length: GRID_LINES + 1 }).map((_, i) => (
            <span key={i}>
              {Math.round((max * (GRID_LINES - i)) / GRID_LINES).toLocaleString('ja-JP')}
            </span>
          ))}
        </div>

        {/* プロットエリア */}
        <div style={{ position: 'relative', flex: 1, minWidth: 0, height: '16rem' }}>
          <div
            aria-hidden="true"
            className="flex flex-col justify-between"
            style={{ position: 'absolute', inset: 0 }}
          >
            {Array.from({ length: GRID_LINES + 1 }).map((_, i) => (
              <div key={i} style={{ height: 1, background: 'var(--chart-grid)', width: '100%' }} />
            ))}
          </div>
          <div
            className="flex items-end justify-between"
            style={{ position: 'relative', height: '100%', gap: 'var(--spacing-2)' }}
          >
            {data.map((d) => {
              const isMax = d.value === max
              const muted = highlightMax && !isMax
              return (
                <div
                  key={d.label}
                  className="flex flex-col items-center justify-end flex-1 min-w-0"
                  style={{ gap: 'var(--spacing-1)', height: '100%' }}
                >
                  <span
                    style={{
                      fontSize: 'var(--font-size-xs)',
                      color: 'var(--foreground-secondary)',
                      fontFamily: 'var(--font-family-mono)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {d.value.toLocaleString('ja-JP')}
                  </span>
                  <div
                    style={{
                      width: '100%',
                      height: `${Math.max((d.value / max) * 88, 1)}%`,
                      background: muted ? 'var(--chart-bar-muted-bg)' : 'var(--chart-bar-bg)',
                      borderRadius: 'var(--radius-sm) var(--radius-sm) 0 0',
                    }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* 横軸ラベル */}
      <div className="flex" style={{ gap: 'var(--spacing-3)' }}>
        <div style={{ visibility: 'hidden', flexShrink: 0 }} aria-hidden="true">
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              fontFamily: 'var(--font-family-mono)',
            }}
          >
            {max.toLocaleString('ja-JP')}
          </span>
        </div>
        <div
          className="flex justify-between"
          style={{ flex: 1, minWidth: 0, gap: 'var(--spacing-2)' }}
        >
          {data.map((d) => (
            <span
              key={d.label}
              className="flex-1 min-w-0 text-center truncate"
              style={{ fontSize: 'var(--font-size-xs)', color: 'var(--chart-axis-label)' }}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>

      <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--chart-axis-label)' }}>
        単位: {unit}
      </span>
    </div>
  )
}
