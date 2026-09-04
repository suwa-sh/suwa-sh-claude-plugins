import React from 'react'
import { Button } from '../ui/Button'
import { Table, type Column } from '../ui/Table'
import { PiiMaskedText } from './PiiMaskedText'
import { formatDate, type User } from './types'

export interface UserTableProps {
  users: User[]
  loading?: boolean
  onEdit?: (u: User) => void
  onDelete?: (u: User) => void
  onOpenStatus?: (u: User) => void
}

export const UserTable: React.FC<UserTableProps> = ({ users, loading, onEdit, onDelete, onOpenStatus }) => {
  const columns: Column<User>[] = [
    { key: 'number', header: '利用者番号', render: (u) => u.number, mono: true, width: '8rem' },
    { key: 'name', header: '氏名', render: (u) => <span style={{ fontWeight: 600 }}>{u.name}</span> },
    { key: 'email', header: 'メールアドレス', render: (u) => <PiiMaskedText value={u.email} kind="email" /> },
    { key: 'phone', header: '電話番号', render: (u) => <PiiMaskedText value={u.phone} kind="phone" /> },
    { key: 'reg', header: '登録日', render: (u) => formatDate(u.registeredAt), mono: true },
    {
      key: 'actions',
      header: '操作',
      align: 'right',
      render: (u) => (
        <div className="flex justify-end" style={{ gap: 'var(--spacing-1)' }}>
          <Button size="sm" variant="ghost" icon="id-card" onClick={() => onOpenStatus?.(u)}>
            利用状況
          </Button>
          <Button size="sm" variant="ghost" icon="edit" onClick={() => onEdit?.(u)}>
            編集
          </Button>
          <Button size="sm" variant="ghost" icon="trash" onClick={() => onDelete?.(u)}>
            削除
          </Button>
        </div>
      ),
    },
  ]
  return <Table columns={columns} rows={users} rowKey={(u) => u.number} loading={loading} caption="利用者一覧" emptyTitle="登録済みの利用者がいません" emptyDescription="窓口で利用登録を受け付けたら「利用者登録」から登録してください" />
}
