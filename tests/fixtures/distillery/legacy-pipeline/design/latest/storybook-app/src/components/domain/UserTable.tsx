import React from 'react'
import { Alert, EmptyState, SkeletonTable } from '../ui/Feedback'
import { Icon } from '../ui/Icon'
import { Table } from '../ui/Table'
import type { TableColumn } from '../ui/Table'
import { UserStatusBadge } from './StatusBadges'
import { maskEmail } from './UserProfileCard'
import type { UserState } from './stateMaps'

export interface User {
  userNumber: string
  name: string
  email: string
  category: string
  state: UserState
  activeLoans: number
  activeReservations: number
}

export interface UserTableProps {
  users: User[]
  loading?: boolean
  error?: string
  actionsFor?: (u: User) => React.ReactNode
}

const numberStyle: React.CSSProperties = {
  fontFamily: 'var(--font-family-mono)',
  fontVariantNumeric: 'tabular-nums',
}

/**
 * 利用者名簿画面の一覧。
 * 連絡先は一覧上では常にマスクする（NFR E.1.2.1 / arch SR-006 個人情報表示の最小化）。
 */
export const UserTable: React.FC<UserTableProps> = ({
  users,
  loading = false,
  error,
  actionsFor,
}) => {
  const columns: TableColumn<User>[] = [
    {
      key: 'userNumber',
      header: '利用者番号',
      mono: true,
      render: (u) => u.userNumber,
    },
    { key: 'name', header: '氏名', render: (u) => u.name },
    {
      key: 'email',
      header: '連絡先',
      render: (u) => (
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
          }}
        >
          <Icon name="shield-check" size={12} label="マスク表示" />
          {maskEmail(u.email)}
        </span>
      ),
    },
    { key: 'category', header: '区分', render: (u) => u.category },
    {
      key: 'activeLoans',
      header: '貸出中',
      align: 'right',
      mono: true,
      render: (u) => `${u.activeLoans.toLocaleString('ja-JP')} 冊`,
    },
    {
      key: 'activeReservations',
      header: '予約中',
      align: 'right',
      mono: true,
      render: (u) => `${u.activeReservations.toLocaleString('ja-JP')} 件`,
    },
    {
      key: 'state',
      header: '状態',
      render: (u) => <UserStatusBadge state={u.state} dot />,
    },
    ...(actionsFor
      ? [
          {
            key: 'actions',
            header: '操作',
            align: 'right' as const,
            render: (u: User) => (
              <div
                className="inline-flex items-center justify-end"
                style={{ gap: 'var(--spacing-2)' }}
              >
                {actionsFor(u)}
              </div>
            ),
          },
        ]
      : []),
  ]

  return (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      <div className="flex flex-wrap items-center justify-between" style={{ gap: 'var(--spacing-2)' }}>
        <h3
          style={{
            fontSize: 'var(--font-size-base)',
            fontWeight: 600,
            color: 'var(--foreground)',
            margin: 0,
          }}
        >
          利用者名簿
        </h3>
        <span
          className="inline-flex items-center"
          style={{
            gap: 'var(--spacing-1)',
            fontSize: 'var(--font-size-xs)',
            color: 'var(--foreground-muted)',
          }}
        >
          <Icon name="shield-check" size={14} label="個人情報保護" />
          個人情報保護のため一部を伏せています
        </span>
      </div>

      {loading ? (
        <SkeletonTable rows={6} cols={7} />
      ) : error ? (
        <Alert tone="destructive" title="利用者名簿を取得できませんでした">
          {error}
        </Alert>
      ) : (
        <Table
          columns={columns}
          rows={users}
          rowKey={(u) => u.userNumber}
          caption="利用者名簿一覧"
          empty={
            <EmptyState
              icon="users"
              title="該当する利用者がいません"
              description="検索条件を変えて、もう一度お試しください。"
            />
          }
        />
      )}
    </div>
  )
}
