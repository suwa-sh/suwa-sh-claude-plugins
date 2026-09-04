import React from 'react'
import { Card } from '../ui/Card'
import { EmptyState, LoadingBlock, Skeleton } from '../ui/Feedback'
import { Icon, type IconName } from '../ui/Icon'
import { Input } from '../ui/Input'
import { ToggleGroup } from '../ui/ToggleGroup'
import type { Book, Granularity } from './types'

/* ---------- StatCard ---------- */
export interface StatCardProps {
  label: string
  value: number | string
  unit?: string
  /** 前期比（例: +12）。正なら success、負なら destructive */
  delta?: number
  deltaLabel?: string
  icon?: IconName
  tone?: 'default' | 'warning' | 'destructive'
  loading?: boolean
}

export const StatCard: React.FC<StatCardProps> = ({ label, value, unit, delta, deltaLabel = '前期比', icon, tone = 'default', loading }) => (
  <Card style={{ padding: 'var(--spacing-4) var(--spacing-5)' }}>
    <div className="flex items-start justify-between" style={{ gap: 'var(--spacing-3)' }}>
      <div className="min-w-0 flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--stat-label-color)' }}>{label}</span>
        {loading ? (
          <Skeleton height="2.25rem" width="6rem" />
        ) : (
          <span className="flex items-baseline" style={{ gap: 'var(--spacing-1)' }}>
            <span style={{ fontSize: 'var(--stat-value-size)', fontWeight: 700, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', color: tone === 'destructive' ? 'var(--destructive)' : tone === 'warning' ? 'var(--warning)' : 'var(--foreground)' }}>
              {typeof value === 'number' ? value.toLocaleString('ja-JP') : value}
            </span>
            {unit ? <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>{unit}</span> : null}
          </span>
        )}
        {delta !== undefined && !loading ? (
          <span className="inline-flex items-center" style={{ gap: 4, fontSize: 'var(--font-size-xs)', color: delta >= 0 ? 'var(--success)' : 'var(--destructive)' }}>
            <Icon name={delta >= 0 ? 'arrow-right' : 'arrow-left'} size={12} className={delta >= 0 ? '-rotate-45' : 'rotate-45'} />
            {delta >= 0 ? '+' : ''}
            {delta} <span style={{ color: 'var(--foreground-muted)' }}>{deltaLabel}</span>
          </span>
        ) : null}
      </div>
      {icon ? (
        <span className="flex shrink-0 items-center justify-center rounded-full" style={{ width: 40, height: 40, background: 'var(--primary-light)', color: 'var(--primary)' }}>
          <Icon name={icon} size={20} />
        </span>
      ) : null}
    </div>
  </Card>
)

/* ---------- PeriodSelector ---------- */
export interface PeriodValue {
  granularity: Granularity
  from: string
  to: string
}

export interface PeriodSelectorProps {
  value: PeriodValue
  onChange: (v: PeriodValue) => void
  disabled?: boolean
}

export const PeriodSelector: React.FC<PeriodSelectorProps> = ({ value, onChange, disabled }) => (
  <div className="flex flex-wrap items-end" style={{ gap: 'var(--spacing-3)' }}>
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>集計単位</span>
      <ToggleGroup<Granularity> label="集計期間種別" options={[{ value: '日', label: '日' }, { value: '月', label: '月' }, { value: '年', label: '年' }]} value={value.granularity} onChange={(g) => onChange({ ...value, granularity: g })} disabled={disabled} />
    </div>
    <Input label="開始日" type="date" value={value.from} onChange={(e) => onChange({ ...value, from: e.target.value })} disabled={disabled} className="flex-1 min-w-0" style={{ minWidth: '10rem' }} />
    <Input label="終了日" type="date" value={value.to} onChange={(e) => onChange({ ...value, to: e.target.value })} disabled={disabled} className="flex-1 min-w-0" style={{ minWidth: '10rem' }} />
  </div>
)

/* ---------- RankingList ---------- */
export interface RankingItem {
  rank: number
  book: Pick<Book, 'id' | 'title' | 'author' | 'genre'>
  count: number
}

export interface RankingListProps {
  items: RankingItem[]
  loading?: boolean
  limit?: number
}

export const RankingList: React.FC<RankingListProps> = ({ items, loading, limit = 10 }) => {
  if (loading) return <LoadingBlock message="ランキングを集計中です…" />
  if (items.length === 0) return <EmptyState icon="trophy" title="集計期間に貸出がありません" description="期間を広げて再集計してください" />
  const max = Math.max(...items.map((i) => i.count))
  return (
    <ol className="flex flex-col" style={{ gap: 'var(--spacing-2)' }} aria-label="人気書籍ランキング">
      {items.slice(0, limit).map((it) => (
        <li key={it.book.id} className="flex items-center" style={{ gap: 'var(--spacing-3)' }}>
          <span
            className="flex shrink-0 items-center justify-center rounded-full"
            style={{
              width: 32,
              height: 32,
              fontWeight: 700,
              fontSize: 'var(--font-size-sm)',
              background: it.rank <= 3 ? 'var(--primary)' : 'var(--background-muted)',
              color: it.rank <= 3 ? 'var(--primary-foreground)' : 'var(--foreground-secondary)',
            }}
          >
            {it.rank}
          </span>
          <div className="min-w-0 flex-1 flex flex-col" style={{ gap: 2 }}>
            <div className="flex items-baseline justify-between" style={{ gap: 'var(--spacing-3)' }}>
              <span className="truncate" style={{ fontWeight: 600 }}>
                {it.book.title}
              </span>
              <span className="shrink-0" style={{ fontSize: 'var(--font-size-sm)', fontVariantNumeric: 'tabular-nums' }}>
                {it.count} 回
              </span>
            </div>
            <span className="truncate" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>
              {it.book.author} ・ {it.book.genre}
            </span>
            <span aria-hidden className="block w-full rounded-full" style={{ height: 6, background: 'var(--chart-bar-muted)' }}>
              <span className="block h-full rounded-full" style={{ width: `${(it.count / max) * 100}%`, background: 'var(--chart-bar)' }} />
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}

/* ---------- PeriodStatChart ---------- */
export interface PeriodStatChartProps {
  series: { label: string; value: number }[]
  granularity: Granularity
  loading?: boolean
  height?: number
}

/** 期間別貸出件数の棒グラフ（依存なし SVG）。色はトークンから */
export const PeriodStatChart: React.FC<PeriodStatChartProps> = ({ series, granularity, loading, height = 240 }) => {
  if (loading) return <LoadingBlock message="貸出統計を集計中です…" />
  if (series.length === 0) return <EmptyState icon="chart-bar" title="集計期間に貸出がありません" />
  const max = Math.max(...series.map((s) => s.value), 1)
  const w = 640
  const padL = 44
  const padB = 28
  const padT = 20
  const innerW = w - padL - 8
  const innerH = height - padB - padT
  const bw = innerW / series.length
  const ticks = 4
  return (
    <figure>
      <svg viewBox={`0 0 ${w} ${height}`} role="img" aria-label={`${granularity}別の貸出件数`} className="w-full" style={{ maxHeight: height }}>
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const y = padT + (innerH * i) / ticks
          const v = Math.round(max - (max * i) / ticks)
          return (
            <g key={i}>
              <line x1={padL} x2={w - 8} y1={y} y2={y} stroke="var(--chart-grid)" strokeWidth={1} />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize={11} fill="var(--foreground-muted)">
                {v}
              </text>
            </g>
          )
        })}
        {series.map((s, i) => {
          const h = (s.value / max) * innerH
          const x = padL + i * bw + bw * 0.2
          const y = padT + innerH - h
          return (
            <g key={s.label}>
              <rect x={x} y={y} width={bw * 0.6} height={h} rx={4} fill="var(--chart-bar)">
                <title>
                  {s.label}: {s.value} 件
                </title>
              </rect>
              <text x={x + bw * 0.3} y={height - 8} textAnchor="middle" fontSize={11} fill="var(--foreground-secondary)">
                {s.label}
              </text>
              <text x={x + bw * 0.3} y={y - 4} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--foreground)">
                {s.value}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="sr-only">
        {series.map((s) => `${s.label} ${s.value} 件`).join('、')}
      </figcaption>
    </figure>
  )
}
