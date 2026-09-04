import React from 'react'
import { Button } from '../ui/Button'
import { Alert, EmptyState, SkeletonTable } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Table } from '../ui/Table'
import type { TableColumn } from '../ui/Table'
import { NotificationStatusBadge } from './StatusBadges'
import type { NotificationState } from './stateMaps'
import { formatDateTable } from '../common/dateFormat'

export interface NotificationLog {
  notificationId: string
  type: string
  timing: string
  userNumber: string
  /** 送信元で既にマスク済みのメールアドレス（arch SR-006） */
  maskedEmail: string
  sentAt?: string
  result?: string
  state: NotificationState
}

export interface NotificationLogTableProps {
  logs: NotificationLog[]
  loading?: boolean
  onRetry?: (log: NotificationLog) => void
}

function formatSentAt(sentAt?: string): string {
  if (!sentAt) return '—'
  const d = new Date(sentAt)
  const time = d.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', hour12: false })
  return `${formatDateTable(sentAt)} ${time}`
}

/**
 * 取置き通知送信画面・リマインド送信画面・督促送信画面で使う送信実績一覧。
 * 送信失敗の行にだけ再送操作を出す。
 */
export const NotificationLogTable: React.FC<NotificationLogTableProps> = ({
  logs,
  loading = false,
  onRetry,
}) => {
  const failedCount = logs.filter((l) => l.state === '送信失敗').length

  const columns: TableColumn<NotificationLog>[] = [
    { key: 'notificationId', header: '通知ID', mono: true, render: (l) => l.notificationId },
    { key: 'type', header: '種別', render: (l) => l.type },
    { key: 'timing', header: 'タイミング', render: (l) => l.timing },
    {
      key: 'destination',
      header: '宛先',
      render: (l) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <span
            style={{
              fontFamily: 'var(--font-family-mono)',
              fontVariantNumeric: 'tabular-nums',
              fontSize: 'var(--font-size-sm)',
              color: 'var(--foreground)',
            }}
          >
            {l.userNumber}
          </span>
          <span
            className="inline-flex items-center"
            style={{
              gap: 'var(--spacing-1)',
              background: 'var(--pii-mask-bg)',
              color: 'var(--pii-mask-color)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--spacing-1) var(--spacing-2)',
              fontFamily: 'var(--font-family-mono)',
              fontSize: 'var(--font-size-xs)',
              alignSelf: 'flex-start',
            }}
          >
            <Icon name="mail" size={12} label="マスク済みメールアドレス" />
            {l.maskedEmail}
          </span>
        </div>
      ),
    },
    {
      key: 'sentAt',
      header: '送信日時',
      mono: true,
      render: (l) => (
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatSentAt(l.sentAt)}</span>
      ),
    },
    {
      key: 'state',
      header: '状態',
      render: (l) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          <NotificationStatusBadge state={l.state} dot />
          {l.result && (
            <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
              {l.result}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (l) =>
        l.state === '送信失敗' && onRetry ? (
          <Button
            variant="outline"
            size="sm"
            iconLeft="refresh-cw"
            onClick={() => onRetry(l)}
            aria-label={`通知 ${l.notificationId} を再送する`}
          >
            再送
          </Button>
        ) : null,
    },
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      {!loading && failedCount > 0 && (
        <Alert tone="warning" title={`${failedCount.toLocaleString('ja-JP')} 件が未達です`}>
          宛先に届いていない通知があります。内容を確認して再送してください。
        </Alert>
      )}
      <h3
        style={{
          fontSize: 'var(--font-size-base)',
          fontWeight: 600,
          color: 'var(--foreground)',
          margin: 0,
        }}
      >
        送信実績
      </h3>
      {loading ? (
        <SkeletonTable rows={5} cols={6} />
      ) : (
        <Table
          columns={columns}
          rows={logs}
          rowKey={(l) => l.notificationId}
          caption="通知送信実績一覧"
          empty={
            <EmptyState
              icon="bell"
              title="送信実績がありません"
              description="通知を送信すると、ここに実績が表示されます。"
            />
          }
        />
      )}
    </div>
  )
}
