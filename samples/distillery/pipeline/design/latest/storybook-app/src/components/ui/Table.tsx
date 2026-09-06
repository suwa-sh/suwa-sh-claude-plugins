import React from 'react'
import { EmptyState, SkeletonTable } from './Feedback'

export interface Column<T> {
  key: string
  header: React.ReactNode
  render: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  /** 等幅表示（ID / ISBN / 日付） */
  mono?: boolean
}

export interface TableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  loading?: boolean
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  onRowClick?: (row: T) => void
  caption?: string
  dense?: boolean
}

export function Table<T>({ columns, rows, rowKey, loading, emptyTitle = 'データがありません', emptyDescription, emptyAction, onRowClick, caption, dense }: TableProps<T>) {
  if (loading) {
    return (
      <div style={{ padding: 'var(--spacing-4)' }}>
        <SkeletonTable cols={Math.min(columns.length, 6)} />
      </div>
    )
  }
  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
  }
  const cellPad = dense ? 'var(--spacing-2) var(--table-cell-padding)' : 'var(--table-cell-padding)'
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse" style={{ fontSize: 'var(--font-size-sm)' }}>
        {caption ? <caption className="sr-only">{caption}</caption> : null}
        <thead>
          <tr style={{ background: 'var(--table-header-bg)' }}>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className="whitespace-nowrap border-b"
                style={{
                  padding: cellPad,
                  textAlign: c.align ?? 'left',
                  width: c.width,
                  color: 'var(--foreground-secondary)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  borderColor: 'var(--table-border)',
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={onRowClick ? 'cursor-pointer hover:bg-hover-muted' : ''}
              style={{ transitionDuration: 'var(--duration-fast)' }}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className="border-b align-middle"
                  style={{
                    padding: cellPad,
                    height: dense ? undefined : 'var(--table-row-height)',
                    textAlign: c.align ?? 'left',
                    borderColor: 'var(--table-border)',
                    fontFamily: c.mono ? 'var(--font-family-mono)' : undefined,
                  }}
                >
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
