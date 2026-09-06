import React from 'react'
import { Icon } from '../ui/Icon'
import type { ReservationState } from './types'

export interface ReservationQueueTrackerProps {
  state: ReservationState | '完了'
  /** 自分の予約順位（1 始まり） */
  position?: number
  /** 予約総数 */
  total?: number
  compact?: boolean
}

const steps = ['予約中', '通知済み', '貸出完了'] as const

/**
 * 予約の進行をステップ表示する。取消の場合は取り消し済みとして全ステップを無効化する。
 */
export const ReservationQueueTracker: React.FC<ReservationQueueTrackerProps> = ({ state, position, total, compact }) => {
  const cancelled = state === '取消'
  const current = state === '予約中' ? 0 : state === '通知済み' ? 1 : 2
  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      {position !== undefined ? (
        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
          {cancelled ? (
            '取り消された予約です'
          ) : (
            <>
              予約順位 <strong style={{ color: 'var(--foreground)', fontSize: 'var(--font-size-lg)' }}>{position}</strong> 位
              {total ? ` / ${total} 人待ち` : null}
              {position === 1 && state === '予約中' ? '（次に返却されたら通知されます）' : null}
            </>
          )}
        </p>
      ) : null}
      <ol className="flex items-center" style={{ gap: 0 }} aria-label="予約の進行">
        {steps.map((label, i) => {
          const done = !cancelled && i < current
          const active = !cancelled && i === current
          const color = cancelled ? 'var(--foreground-muted)' : done ? 'var(--queue-done)' : active ? 'var(--queue-current)' : 'var(--queue-todo)'
          return (
            <li key={label} className="flex items-center" aria-current={active ? 'step' : undefined}>
              <span className="flex flex-col items-center" style={{ gap: 'var(--spacing-1)', minWidth: compact ? '4rem' : '5.5rem' }}>
                <span
                  className="flex items-center justify-center rounded-full border-2"
                  style={{
                    width: compact ? 24 : 28,
                    height: compact ? 24 : 28,
                    borderColor: color,
                    background: done ? color : 'transparent',
                    color: done ? 'var(--color-white)' : color,
                    fontSize: 'var(--font-size-xs)',
                    fontWeight: 600,
                  }}
                >
                  {done ? <Icon name="check" size={14} /> : cancelled ? <Icon name="x" size={14} /> : i + 1}
                </span>
                <span style={{ fontSize: 'var(--font-size-xs)', color: active ? 'var(--foreground)' : 'var(--foreground-secondary)', fontWeight: active ? 600 : 400, whiteSpace: 'nowrap' }}>{label}</span>
              </span>
              {i < steps.length - 1 ? (
                <span aria-hidden style={{ width: compact ? '1.5rem' : '2.5rem', height: 2, background: done ? 'var(--queue-done)' : 'var(--queue-todo)', marginBottom: '1.25rem' }} />
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
