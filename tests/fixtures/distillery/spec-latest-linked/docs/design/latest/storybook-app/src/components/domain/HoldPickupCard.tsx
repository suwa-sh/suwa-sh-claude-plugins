import React from 'react'
import { Card, CardHeader } from '../ui/Card'
import { Alert } from '../ui/Feedback'
import { Button } from '../ui/Button'
import { Icon } from '../ui/Icon'
import { daysUntil, formatDateTimeLong, formatDeadlineWithRemaining } from '../common/dateFormat'

export interface HoldPickupCardProps {
  bookTitle: string
  author: string
  /** 取置き開始日時（ISO） */
  holdStartAt: string
  /** 取置き期限（ISO） */
  holdDeadline: string
  /** 受取窓口で提示する利用者番号 */
  userNumber: string
  /** 判定基準日（ISO）。既定は当日 */
  today?: string
  /** 期限当日は deadline-today で強調する（既定は today から自動判定） */
  variant?: 'default' | 'deadline-today'
  onCancel?: () => void
}

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontVariantNumeric: 'tabular-nums',
}

/** 取置き受取案内画面 / 取置き中予約確認画面で使う受取案内カード */
export const HoldPickupCard: React.FC<HoldPickupCardProps> = ({
  bookTitle,
  author,
  holdStartAt,
  holdDeadline,
  userNumber,
  today,
  variant,
  onCancel,
}) => {
  const baseDate = today ?? holdDeadline
  const remaining = daysUntil(holdDeadline, baseDate)
  const resolvedVariant = variant ?? (remaining <= 0 ? 'deadline-today' : 'default')
  const isDeadlineToday = resolvedVariant === 'deadline-today'

  return (
    <Card>
      <CardHeader title={bookTitle} description={author} />
      <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
        <Alert tone="warning" title={isDeadlineToday ? '本日が受取期限' : '取置き期限までに来館してください'}>
          期限を過ぎると取置きは解除され、次の予約者に案内されます。
        </Alert>

        <div
          className="flex flex-col items-center"
          style={{
            gap: 'var(--spacing-2)',
            padding: 'var(--spacing-6)',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--background-subtle)',
            border: '1px solid var(--border)',
          }}
        >
          <span
            className="flex items-center"
            style={{
              gap: 'var(--spacing-2)',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--foreground-secondary)',
            }}
          >
            <Icon name="id-card" size={16} />
            受取窓口で提示する利用者番号
          </span>
          <span
            style={{
              ...monoStyle,
              fontSize: 'var(--font-size-3xl)',
              fontWeight: 700,
              letterSpacing: '0.08em',
              color: 'var(--foreground)',
            }}
          >
            {userNumber}
          </span>
        </div>

        <dl className="grid grid-cols-2" style={{ gap: 'var(--spacing-4)', margin: 0 }}>
          <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
            <dt
              className="flex items-center"
              style={{
                gap: 'var(--spacing-1)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--foreground-secondary)',
              }}
            >
              <Icon name="calendar" size={14} />
              取置き開始日時
            </dt>
            <dd style={{ ...monoStyle, margin: 0, color: 'var(--foreground)' }}>
              {formatDateTimeLong(holdStartAt)}
            </dd>
          </div>
          <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
            <dt
              className="flex items-center"
              style={{
                gap: 'var(--spacing-1)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--foreground-secondary)',
              }}
            >
              <Icon name="calendar-clock" size={14} />
              取置き期限
            </dt>
            <dd
              style={{
                ...monoStyle,
                margin: 0,
                fontWeight: 600,
                color: remaining < 0 ? 'var(--duedate-over-color)' : 'var(--duedate-near-color)',
              }}
            >
              {formatDeadlineWithRemaining(holdDeadline, baseDate, 'pickup')}
            </dd>
          </div>
        </dl>

        {onCancel && (
          <div className="flex justify-end">
            <Button variant="outline" iconLeft="x-circle" onClick={onCancel}>
              予約を取り消す
            </Button>
          </div>
        )}
      </div>
    </Card>
  )
}
