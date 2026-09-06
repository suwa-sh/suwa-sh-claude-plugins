import React from 'react'
import { Icon } from '../ui/Icon'
import type { LoanState } from './stateMaps'
import { daysUntil, formatDateLong, formatDateTable, formatRemaining, type DeadlineKind } from '../common/dateFormat'

export type DueDateLevel = 'safe' | 'near' | 'over' | 'returned'

export interface DueDateIndicatorProps {
  /** 返却期限（ISO 日付文字列） */
  dueDate: string
  /** 判定基準日（ISO 日付文字列）。Story / テストで固定するために外から渡す */
  today?: string
  /** 貸出状態。返却済みは中立表示にする */
  state: LoanState
  size?: 'sm' | 'md'
  /** 期限の種別。当日文言だけを差し替える（既定 return = 返却期限） */
  kind?: DeadlineKind
  /** 日付の書式。既定 long（`YYYY年M月D日`）。テーブル列内では table（`YYYY/MM/DD`）を渡す */
  dateFormat?: 'long' | 'table'
}

/** 残日数（正: 期限まで N 日 / 0: 当日 / 負: N 日超過） */
export function daysUntilDue(dueDate: string, today: string): number {
  return daysUntil(dueDate, today)
}

export function dueDateLevel(remaining: number, state: LoanState): DueDateLevel {
  if (state === '返却済み') return 'returned'
  if (remaining < 0) return 'over'
  if (remaining <= 3) return 'near'
  return 'safe'
}

const levelToken: Record<DueDateLevel, { color: string; bg: string; icon: string }> = {
  safe: {
    color: 'var(--duedate-safe-color)',
    bg: 'var(--duedate-safe-bg)',
    icon: 'calendar-clock',
  },
  near: {
    color: 'var(--duedate-near-color)',
    bg: 'var(--duedate-near-bg)',
    icon: 'calendar-clock',
  },
  over: {
    color: 'var(--duedate-over-color)',
    bg: 'var(--duedate-over-bg)',
    icon: 'alert-triangle',
  },
  returned: {
    color: 'var(--foreground-secondary)',
    bg: 'var(--background-muted)',
    icon: 'check-circle',
  },
}

function statusText(level: DueDateLevel, remaining: number, kind: DeadlineKind): string {
  if (level === 'returned') return '返却済み'
  return formatRemaining(remaining, kind)
}

/**
 * 返却期限（既定）/ 取置き期限の残日数・超過日数を可視化する。
 * 色だけに依存せず、必ずアイコンとテキストで状況を示す（JIS X 8341-3 AA 目標）。
 * 文言は `_cross-cutting/ux-ui/ui-design.md`「日付・期限の表示規約」に従う（`あと{N}日` / 当日文言 / `{N}日超過`）。
 */
export const DueDateIndicator: React.FC<DueDateIndicatorProps> = ({
  dueDate,
  today,
  state,
  size = 'md',
  kind = 'return',
  dateFormat = 'long',
}) => {
  const baseDate = today ?? dueDate
  const remaining = daysUntilDue(dueDate, baseDate)
  const level = dueDateLevel(remaining, state)
  const token = levelToken[level]
  const label = statusText(level, remaining, kind)
  const dueLabel = dateFormat === 'table' ? formatDateTable(dueDate) : formatDateLong(dueDate)

  return (
    <span
      className="inline-flex items-center"
      style={{
        gap: size === 'sm' ? 'var(--spacing-1)' : 'var(--spacing-2)',
        padding:
          size === 'sm'
            ? 'var(--spacing-1) var(--spacing-2)'
            : 'var(--spacing-2) var(--spacing-3)',
        borderRadius: 'var(--radius-md)',
        background: token.bg,
        color: token.color,
        fontSize: size === 'sm' ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
        lineHeight: 'var(--line-height-tight)',
      }}
    >
      <Icon
        name={token.icon}
        size={size === 'sm' ? 14 : 16}
        label={`返却期限 ${dueLabel}: ${label}`}
      />
      <span
        style={{
          fontFamily: 'var(--font-family-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {dueLabel}
      </span>
      <span style={{ fontWeight: 600 }}>{label}</span>
    </span>
  )
}
