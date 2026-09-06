import React from 'react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Table, type Column } from '../ui/Table'
import { DueDateIndicator } from './DueDateIndicator'
import { PiiMaskedText } from './PiiMaskedText'
import { LoanStatusBadge, ReservationStatusBadge } from './StatusBadges'
import { daysBetween, formatDate, formatDateTime, type Loan, type NotificationLog, type Reservation } from './types'

/* ---------- LoanTable ---------- */
export interface LoanTableProps {
  loans: Loan[]
  today: string
  variant?: 'current' | 'history'
  /** 司書向け: 利用者列を表示 */
  showUser?: boolean
  loading?: boolean
  remindDays?: number
}

export const LoanTable: React.FC<LoanTableProps> = ({ loans, today, variant = 'current', showUser, loading, remindDays = 3 }) => {
  const columns: Column<Loan>[] = [
    {
      key: 'book',
      header: '書籍',
      render: (l) => (
        <div className="flex flex-col" style={{ gap: 2, minWidth: '12rem' }}>
          <span style={{ fontWeight: 600 }}>{l.book.title}</span>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>{l.book.author}</span>
        </div>
      ),
    },
  ]
  if (showUser) {
    columns.push({ key: 'user', header: '利用者', render: (l) => `${l.userName ?? ''} (${l.userNumber})` })
  }
  columns.push({ key: 'loaned', header: '貸出日', render: (l) => formatDate(l.loanedAt), mono: true })
  if (variant === 'current') {
    columns.push({ key: 'due', header: '返却期限', render: (l) => <DueDateIndicator dueDate={l.dueDate} today={today} remindDays={remindDays} returned={l.state === '返却済み'} /> })
  } else {
    columns.push({ key: 'due', header: '返却期限', render: (l) => formatDate(l.dueDate), mono: true })
    columns.push({ key: 'returned', header: '返却日', render: (l) => (l.returnedAt ? formatDate(l.returnedAt) : '—'), mono: true })
  }
  columns.push({ key: 'state', header: '状態', render: (l) => <LoanStatusBadge state={l.state} dot /> })
  return <Table columns={columns} rows={loans} rowKey={(l) => l.id} loading={loading} caption="貸出一覧" emptyTitle={variant === 'current' ? '現在借りている書籍はありません' : '貸出履歴はありません'} />
}

/* ---------- OverdueTable ---------- */
export interface OverdueRow extends Loan {
  lastReminderAt?: string
  lastReminderResult?: '成功' | '失敗'
  reminderCount?: number
}

export interface OverdueTableProps {
  rows: OverdueRow[]
  today: string
  loading?: boolean
  onOpenUser?: (row: OverdueRow) => void
}

export const OverdueTable: React.FC<OverdueTableProps> = ({ rows, today, loading, onOpenUser }) => {
  const columns: Column<OverdueRow>[] = [
    { key: 'user', header: '利用者', render: (r) => (
      <div className="flex flex-col" style={{ gap: 2 }}>
        <span style={{ fontWeight: 600 }}>{r.userName}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', fontFamily: 'var(--font-family-mono)', color: 'var(--foreground-secondary)' }}>{r.userNumber}</span>
      </div>
    ) },
    { key: 'book', header: '書籍', render: (r) => r.book.title },
    { key: 'due', header: '返却期限', render: (r) => <DueDateIndicator dueDate={r.dueDate} today={today} /> },
    { key: 'days', header: '延滞日数', align: 'right', render: (r) => <span style={{ fontWeight: 600, color: 'var(--destructive)', fontVariantNumeric: 'tabular-nums' }}>{-daysBetween(today, r.dueDate)} 日</span> },
    { key: 'reminder', header: '最終督促', render: (r) => (r.lastReminderAt ? (
      <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
        <span style={{ fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-xs)' }}>{formatDateTime(r.lastReminderAt)}</span>
        <Badge variant={r.lastReminderResult === '失敗' ? 'destructive' : 'success'} icon={r.lastReminderResult === '失敗' ? 'mail-warning' : 'mail-check'}>
          {r.lastReminderResult ?? '成功'}{r.reminderCount ? ` (${r.reminderCount} 回)` : ''}
        </Badge>
      </div>
    ) : <Badge variant="neutral">未送信</Badge>) },
    { key: 'actions', header: '', align: 'right', render: (r) => <Button size="sm" variant="ghost" icon="id-card" onClick={() => onOpenUser?.(r)}>利用状況</Button> },
  ]
  return <Table columns={columns} rows={rows} rowKey={(r) => r.id} loading={loading} caption="延滞一覧" emptyTitle="延滞中の貸出はありません" emptyDescription="日次バッチが返却期限超過を判定すると、ここに表示されます" />
}

/* ---------- NotificationLogTable ---------- */
export interface NotificationLogTableProps {
  logs: NotificationLog[]
  loading?: boolean
}

const kindVariant = { 返却通知: 'analysis', リマインド: 'warning', 督促: 'destructive' } as const

export const NotificationLogTable: React.FC<NotificationLogTableProps> = ({ logs, loading }) => {
  const columns: Column<NotificationLog>[] = [
    { key: 'kind', header: '通知種別', render: (n) => <Badge variant={kindVariant[n.kind]}>{n.kind}</Badge> },
    { key: 'to', header: '送信先', render: (n) => <PiiMaskedText value={n.to} kind="email" /> },
    { key: 'subject', header: '件名', render: (n) => n.subject },
    { key: 'sent', header: '送信日時', render: (n) => formatDateTime(n.sentAt), mono: true },
    { key: 'result', header: '送信結果', render: (n) => <Badge variant={n.result === '成功' ? 'success' : 'destructive'} icon={n.result === '成功' ? 'mail-check' : 'mail-warning'}>{n.result}</Badge> },
  ]
  return <Table columns={columns} rows={logs} rowKey={(n) => n.id} loading={loading} dense caption="通知送信記録" emptyTitle="送信記録はありません" />
}

/* ---------- ReservationTable ---------- */
export interface ReservationTableProps {
  reservations: Reservation[]
  showUser?: boolean
  loading?: boolean
  onCancel?: (r: Reservation) => void
}

export const ReservationTable: React.FC<ReservationTableProps> = ({ reservations, showUser, loading, onCancel }) => {
  const columns: Column<Reservation>[] = [
    { key: 'pos', header: '順位', align: 'center', width: '4rem', render: (r) => (r.state === '取消' ? '—' : <span style={{ fontWeight: 700, fontSize: 'var(--font-size-lg)' }}>{r.position}</span>) },
    { key: 'book', header: '書籍', render: (r) => (
      <div className="flex flex-col" style={{ gap: 2, minWidth: '12rem' }}>
        <span style={{ fontWeight: 600 }}>{r.book.title}</span>
        <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-secondary)' }}>{r.book.author}</span>
      </div>
    ) },
  ]
  if (showUser) columns.push({ key: 'user', header: '利用者', render: (r) => `${r.userName ?? ''} (${r.userNumber})` })
  columns.push({ key: 'accepted', header: '受付日時', render: (r) => formatDateTime(r.acceptedAt), mono: true })
  columns.push({ key: 'state', header: '状態', render: (r) => <ReservationStatusBadge state={r.state} dot /> })
  if (onCancel) {
    columns.push({ key: 'actions', header: '', align: 'right', render: (r) => (r.state === '取消' ? null : <Button size="sm" variant="outline" icon="x" onClick={() => onCancel(r)}>予約を取り消す</Button>) })
  }
  return <Table columns={columns} rows={reservations} rowKey={(r) => r.id} loading={loading} caption="予約一覧" emptyTitle="予約はありません" emptyDescription="貸出中の書籍は書籍詳細から予約できます" />
}
