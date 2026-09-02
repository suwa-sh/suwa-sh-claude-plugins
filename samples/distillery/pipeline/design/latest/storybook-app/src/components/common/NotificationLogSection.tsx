import React from 'react'
import { NotificationLogTable, type NotificationLog } from '@/components/domain/NotificationLogTable'
import { Alert } from '@/components/ui/Feedback'
import { SubmitActionButton } from './SubmitActionButton'

export interface NotificationLogCounts {
  送信待ち: number
  送信済み: number
  送信失敗: number
}

export interface NotificationLogSectionProps {
  notificationType: '取置き通知' | 'リマインド' | '督促'
  counts: NotificationLogCounts
  logs: NotificationLog[]
  loading?: boolean
  onSend: () => void
  onRetry?: (log: NotificationLog) => void
  sending?: boolean
}

/**
 * 通知 3 UC（取置き通知 / リマインド / 督促）が同一構造
 * （送信対象サマリ → 送信実行 → 送信実績一覧 → 失敗行の再送）を持つためのテンプレート。
 */
export const NotificationLogSection: React.FC<NotificationLogSectionProps> = ({
  notificationType,
  counts,
  logs,
  loading = false,
  onSend,
  onRetry,
  sending = false,
}) => (
  <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
    {counts.送信失敗 > 0 && (
      <Alert tone="destructive" title={`送信失敗 ${counts.送信失敗} 件`}>
        失敗した{notificationType}は一覧から個別に再送してください。
      </Alert>
    )}
    <div className="flex items-center justify-between flex-wrap" style={{ gap: 'var(--component-gap)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
        送信待ち {counts.送信待ち} 件 / 送信済み {counts.送信済み} 件 / 送信失敗 {counts.送信失敗} 件
      </span>
      <SubmitActionButton onSubmit={onSend} submitting={sending} disabled={counts.送信待ち === 0}>
        {notificationType}を送信する
      </SubmitActionButton>
    </div>
    <NotificationLogTable logs={logs} loading={loading} onRetry={onRetry} />
  </div>
)
