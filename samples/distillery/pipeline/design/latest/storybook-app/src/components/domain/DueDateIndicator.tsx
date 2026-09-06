import React from 'react'
import { Icon, type IconName } from '../ui/Icon'
import { daysBetween, formatDate } from './types'

export interface DueDateIndicatorProps {
  dueDate: string
  today: string
  /** リマインド日数（情報「リマインド日数」）。既定 3 日 */
  remindDays?: number
  returned?: boolean
  showDate?: boolean
}

export type DueTone = 'ok' | 'soon' | 'overdue' | 'returned'

export const dueTone = (dueDate: string, today: string, remindDays = 3, returned?: boolean): { tone: DueTone; days: number } => {
  const days = daysBetween(today, dueDate)
  if (returned) return { tone: 'returned', days }
  if (days < 0) return { tone: 'overdue', days }
  if (days <= remindDays) return { tone: 'soon', days }
  return { tone: 'ok', days }
}

const toneStyle: Record<DueTone, { color: string; icon: IconName }> = {
  ok: { color: 'var(--due-ok)', icon: 'calendar' },
  soon: { color: 'var(--due-soon)', icon: 'bell' },
  overdue: { color: 'var(--due-overdue)', icon: 'alert-triangle' },
  returned: { color: 'var(--foreground-muted)', icon: 'check' },
}

/** 返却期限と残日数。色 + 文言 + アイコンで意味を伝える（色だけに依存しない） */
export const DueDateIndicator: React.FC<DueDateIndicatorProps> = ({ dueDate, today, remindDays = 3, returned, showDate = true }) => {
  const { tone, days } = dueTone(dueDate, today, remindDays, returned)
  const text = tone === 'returned' ? '返却済み' : tone === 'overdue' ? `${-days} 日超過` : days === 0 ? '本日期限' : `あと ${days} 日`
  return (
    <span className="inline-flex items-center whitespace-nowrap" style={{ gap: 'var(--spacing-2)', color: toneStyle[tone].color, fontSize: 'var(--font-size-sm)' }}>
      <Icon name={toneStyle[tone].icon} size={16} />
      {showDate ? (
        <span style={{ fontFamily: 'var(--font-family-mono)', color: 'var(--foreground)' }}>{formatDate(dueDate)}</span>
      ) : null}
      <span style={{ fontWeight: tone === 'overdue' || tone === 'soon' ? 600 : 500 }}>{text}</span>
    </span>
  )
}
