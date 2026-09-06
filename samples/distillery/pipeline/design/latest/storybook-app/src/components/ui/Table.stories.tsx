import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Table } from './Table'
import { Badge } from './Badge'

const meta: Meta = {
  title: 'UI/Table',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

type Row = { id: string; title: string; state: string }
const rows: Row[] = [
  { id: 'B-000101', title: '吾輩は猫である', state: '在庫あり' },
  { id: 'B-000102', title: 'リーダブルコード', state: '貸出中' },
  { id: 'B-000103', title: 'サピエンス全史（上）', state: '予約待ち' },
]
const columns = [
  { key: 'id', header: '書籍 ID', mono: true, render: (r: Row) => r.id },
  { key: 'title', header: 'タイトル', render: (r: Row) => r.title },
  { key: 'state', header: '状態', render: (r: Row) => <Badge variant="neutral">{r.state}</Badge> },
]

export const Default: Story = { render: () => <Table columns={columns} rows={rows} rowKey={(r) => r.id} onRowClick={() => undefined} /> }
export const Empty: Story = { render: () => <Table columns={columns} rows={[]} rowKey={(r) => r.id} emptyTitle="データがありません" emptyDescription="条件を変更してください" /> }
export const Loading: Story = { render: () => <Table columns={columns} rows={[]} rowKey={(r) => r.id} loading /> }
