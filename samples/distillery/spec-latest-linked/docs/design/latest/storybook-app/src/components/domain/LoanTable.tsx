import React from 'react'
import { Table } from '../ui/Table'
import type { TableColumn } from '../ui/Table'
import { Alert, EmptyState, SkeletonTable } from '../ui/Feedback'
import { Button } from '../ui/Button'
import { DueDateIndicator } from './DueDateIndicator'
import { LoanStatusBadge } from './StatusBadges'
import type { LoanState } from './stateMaps'
import { formatDateTable } from '../common/dateFormat'

export interface Loan {
  loanId: string
  bookTitle: string
  bookId: string
  userNumber: string
  userName: string
  loanDate: string
  dueDate: string
  returnDate?: string
  loanPeriodType: string
  state: LoanState
}

export interface LoanTableProps {
  loans: Loan[]
  loading?: boolean
  error?: string
  /** 司書向け。利用者列を表示する */
  showUser?: boolean
  onSelect?: (loan: Loan) => void
  actionsFor?: (loan: Loan) => React.ReactNode
  emptyMessage?: string
  /** 返却期限判定の基準日（ISO）。既定は当日 */
  today?: string
}

const monoStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontVariantNumeric: 'tabular-nums',
}

/**
 * 現在の貸出一覧 / 貸出履歴 / 延滞状況一覧 / 返却期限接近貸出一覧で共通利用する貸出テーブル。
 */
export const LoanTable: React.FC<LoanTableProps> = ({
  loans,
  loading = false,
  error,
  showUser = false,
  onSelect,
  actionsFor,
  emptyMessage = '該当する貸出はありません',
  today,
}) => {
  if (loading) {
    return <SkeletonTable rows={5} cols={showUser ? 7 : 6} />
  }
  if (error) {
    return (
      <Alert tone="destructive" title="貸出情報を取得できませんでした">
        {error}
      </Alert>
    )
  }

  const baseDate = today ?? new Date().toISOString()

  const columns: TableColumn<Loan>[] = [
    {
      key: 'loanId',
      header: '貸出ID',
      mono: true,
      width: '10rem',
      render: (row) => row.loanId,
    },
    {
      key: 'book',
      header: '書籍',
      render: (row) => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
          {onSelect ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onSelect(row)}
              aria-label={`${row.bookTitle} の貸出詳細を開く`}
              style={{ padding: 0, height: 'auto', color: 'var(--primary)' }}
            >
              {row.bookTitle}
            </Button>
          ) : (
            <span style={{ color: 'var(--foreground)' }}>{row.bookTitle}</span>
          )}
          <span
            style={{
              ...monoStyle,
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-muted)',
            }}
          >
            {row.bookId}
          </span>
        </div>
      ),
    },
    ...(showUser
      ? [
          {
            key: 'user',
            header: '利用者',
            render: (row: Loan) => (
              <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
                <span style={{ color: 'var(--foreground)' }}>{row.userName}</span>
                <span
                  style={{
                    ...monoStyle,
                    fontSize: 'var(--font-size-xs)',
                    color: 'var(--foreground-muted)',
                  }}
                >
                  {row.userNumber}
                </span>
              </div>
            ),
          } as TableColumn<Loan>,
        ]
      : []),
    {
      key: 'loanDate',
      header: '貸出日',
      mono: true,
      width: '8rem',
      render: (row) => (
        <span style={monoStyle}>{formatDateTable(row.loanDate)}</span>
      ),
    },
    {
      key: 'dueDate',
      header: '返却期限',
      width: '15rem',
      render: (row) => (
        <DueDateIndicator
          dueDate={row.dueDate}
          today={baseDate}
          state={row.state}
          size="sm"
          dateFormat="table"
        />
      ),
    },
    {
      key: 'state',
      header: '状態',
      width: '8rem',
      render: (row) => <LoanStatusBadge state={row.state} dot />,
    },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      width: '10rem',
      render: (row) => (actionsFor ? actionsFor(row) : null),
    },
  ]

  return (
    <Table
      columns={columns}
      rows={loans}
      rowKey={(row) => row.loanId}
      caption="貸出一覧"
      empty={<EmptyState icon="book-open" title={emptyMessage} />}
    />
  )
}
