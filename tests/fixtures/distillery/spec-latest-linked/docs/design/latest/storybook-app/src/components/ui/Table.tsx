import React from 'react'

export interface TableColumn<T> {
  key: string
  header: React.ReactNode
  /** 行データからセルを描画する */
  render: (row: T) => React.ReactNode
  align?: 'left' | 'right' | 'center'
  width?: string
  /** 数値・ID 列。等幅フォントで揃える */
  mono?: boolean
}

export interface TableProps<T> {
  columns: TableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  caption?: string
  /** 0 件時に差し込む要素（EmptyState を渡す） */
  empty?: React.ReactNode
}

export function Table<T>({ columns, rows, rowKey, caption, empty }: TableProps<T>) {
  if (rows.length === 0 && empty) {
    return <>{empty}</>
  }
  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <table
        className="ds-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--foreground)',
        }}
      >
        {caption && <caption className="ds-sr-only">{caption}</caption>}
        <thead>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                style={{
                  textAlign: c.align ?? 'left',
                  background: 'var(--table-header-bg)',
                  color: 'var(--table-header-foreground)',
                  fontWeight: 600,
                  fontSize: 'var(--font-size-xs)',
                  padding: 'var(--table-cell-padding-y) var(--table-cell-padding-x)',
                  borderBottom: '1px solid var(--table-border)',
                  whiteSpace: 'nowrap',
                  width: c.width,
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={rowKey(row)} style={{ transition: 'background var(--duration-fast)' }}>
              {columns.map((c) => (
                <td
                  key={c.key}
                  style={{
                    textAlign: c.align ?? 'left',
                    padding: 'var(--table-cell-padding-y) var(--table-cell-padding-x)',
                    borderBottom: '1px solid var(--table-border)',
                    minHeight: 'var(--table-row-height)',
                    fontFamily: c.mono ? 'var(--font-family-mono)' : undefined,
                    verticalAlign: 'middle',
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
