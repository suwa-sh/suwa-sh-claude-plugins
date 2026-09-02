import React from 'react'
import { Icon } from '../ui/Icon'
import { ReservationStatusBadge } from './StatusBadges'
import type { ReservationState } from './stateMaps'
import { daysUntil, formatDateLong, formatRemaining } from '../common/dateFormat'

export interface ReservationQueueTrackerProps {
  state: ReservationState
  /** 予約順位（1 始まり） */
  rank?: number
  /** 同一書籍の予約総数 */
  totalReservations?: number
  /** 取置き期限（ISO） */
  holdDeadline?: string
  /** 判定基準日（ISO）。既定は当日 */
  today?: string
  bookTitle: string
}

const steps = [
  { key: '予約中', label: '予約中', icon: 'bookmark' },
  { key: '取置き中', label: '取置き中', icon: 'inbox' },
  { key: '貸出済み', label: '貸出済み', icon: 'check-circle' },
] as const

const stepIndex: Record<ReservationState, number> = {
  予約中: 0,
  取置き中: 1,
  貸出済み: 2,
  キャンセル: -1,
}

/**
 * 予約順位と進行状況（予約中 → 取置き中 → 貸出済み）を表すステップトラッカー。
 * キャンセルは取り消し済みとして中立表示にする。
 */
export const ReservationQueueTracker: React.FC<ReservationQueueTrackerProps> = ({
  state,
  rank,
  totalReservations,
  holdDeadline,
  today,
  bookTitle,
}) => {
  const current = stepIndex[state]
  const cancelled = state === 'キャンセル'
  const baseDate = today ?? new Date().toISOString()
  const remaining = holdDeadline !== undefined ? daysUntil(holdDeadline, baseDate) : undefined

  return (
    <section
      className="flex flex-col"
      style={{ gap: 'var(--component-gap)', width: '100%' }}
      aria-label={`${bookTitle} の予約進行状況`}
    >
      <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)' }}>
        <div className="flex items-center" style={{ gap: 'var(--spacing-2)', minWidth: 0 }}>
          <Icon name="book" size={16} />
          <span style={{ fontWeight: 600, color: 'var(--foreground)' }}>{bookTitle}</span>
        </div>
        <ReservationStatusBadge state={state} dot />
      </div>

      <ol className="flex items-start" style={{ gap: 'var(--spacing-2)', width: '100%' }}>
        {steps.map((step, i) => {
          const done = !cancelled && i < current
          const active = !cancelled && i === current
          const trackBg = done
            ? 'var(--queue-done-bg)'
            : active
              ? 'var(--queue-active-bg)'
              : 'var(--queue-track-bg)'
          return (
            <li
              key={step.key}
              className="flex flex-col flex-1 min-w-0"
              style={{ gap: 'var(--spacing-2)' }}
              aria-current={active ? 'step' : undefined}
            >
              <div
                style={{
                  height: 'var(--spacing-2)',
                  borderRadius: 'var(--radius-full)',
                  background: trackBg,
                  opacity: cancelled ? 0.5 : 1,
                }}
              />
              <div
                className="flex items-center"
                style={{
                  gap: 'var(--spacing-1)',
                  color:
                    active && !cancelled ? 'var(--foreground)' : 'var(--queue-label-color)',
                  fontSize: 'var(--font-size-xs)',
                  fontWeight: active && !cancelled ? 600 : 400,
                }}
              >
                <Icon name={done ? 'check-circle' : step.icon} size={14} />
                <span>
                  {step.label}
                  {done ? '（完了）' : active ? '（現在）' : ''}
                </span>
              </div>
            </li>
          )
        })}
      </ol>

      {cancelled && (
        <p
          style={{
            margin: 0,
            fontSize: 'var(--font-size-sm)',
            color: 'var(--foreground-secondary)',
          }}
        >
          この予約は取り消し済みです。進行状況の更新はありません。
        </p>
      )}

      {state === '予約中' && rank !== undefined && (
        <p
          className="flex items-center"
          style={{
            margin: 0,
            gap: 'var(--spacing-2)',
            fontSize: 'var(--font-size-sm)',
            color: 'var(--foreground)',
          }}
        >
          <Icon name="users" size={16} />
          <span>
            予約順位
            <strong
              style={{
                fontFamily: 'var(--font-family-mono)',
                fontVariantNumeric: 'tabular-nums',
                fontSize: 'var(--font-size-lg)',
                padding: '0 var(--spacing-1)',
                color: rank === 1 ? 'var(--primary)' : 'var(--foreground)',
              }}
            >
              {totalReservations !== undefined
                ? `${totalReservations} 人中 ${rank} 番目`
                : `${rank} 番目`}
            </strong>
            {rank === 1 && <span style={{ color: 'var(--primary)' }}>（次の順番です）</span>}
          </span>
        </p>
      )}

      {state === '取置き中' && holdDeadline !== undefined && (
        <p
          className="flex items-center"
          style={{
            margin: 0,
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-2) var(--spacing-3)',
            borderRadius: 'var(--radius-md)',
            background: 'var(--warning-light)',
            color: 'var(--warning-foreground)',
            fontSize: 'var(--font-size-sm)',
          }}
        >
          <Icon name="calendar-clock" size={16} label="取置き期限" />
          <span>
            取置き期限
            <strong
              style={{
                fontFamily: 'var(--font-family-mono)',
                fontVariantNumeric: 'tabular-nums',
                padding: '0 var(--spacing-1)',
              }}
            >
              {formatDateLong(holdDeadline)}
            </strong>
            {remaining !== undefined && `（${formatRemaining(remaining, 'pickup')}）`}
          </span>
        </p>
      )}
    </section>
  )
}
