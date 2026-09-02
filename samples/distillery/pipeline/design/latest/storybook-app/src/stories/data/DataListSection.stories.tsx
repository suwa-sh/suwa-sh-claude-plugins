import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { DataListSection } from '@/components/common/DataListSection'
import { Table } from '@/components/ui/Table'
import { BookStatusBadge } from '@/components/domain/StatusBadges'

const meta: Meta<typeof DataListSection> = {
  title: 'Common/DataListSection',
  component: DataListSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '「フィルター → 一覧 → ページ送り」の縦積みレイアウトと 20 件/頁の分割ルールを統一する（Table/Domain テーブル + Pagination + AsyncSection の合成）。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof DataListSection>

const rows = [
  { id: '1', title: '吾輩は猫である', state: '在庫あり' as const },
  { id: '2', title: '坊っちゃん', state: '貸出中' as const },
  { id: '3', title: '銀河鉄道の夜', state: '予約待ち' as const },
]

export const Default: Story = {
  render: (args) => {
    const [page, setPage] = React.useState(1)
    return (
      <DataListSection
        {...args}
        page={page}
        onPageChange={setPage}
        table={
          <Table
            caption="蔵書一覧"
            rowKey={(r) => r.id}
            rows={rows}
            columns={[
              { key: 'title', header: '書名', render: (r) => r.title },
              { key: 'state', header: '状態', render: (r) => <BookStatusBadge state={r.state} dot /> },
            ]}
          />
        }
      />
    )
  },
  args: {
    loading: false,
    error: null,
    isEmpty: false,
    emptyMessage: '条件に一致する書籍がありません',
    total: 43,
    totalPages: 3,
  },
}
