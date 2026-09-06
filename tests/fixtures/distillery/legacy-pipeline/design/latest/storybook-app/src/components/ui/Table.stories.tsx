import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Table } from './Table'
import type { TableColumn } from './Table'
import { Badge } from './Badge'
import { Button } from './Button'
import { EmptyState } from './Feedback'

interface Book {
  bookId: string
  title: string
  author: string
  genre: string
  state: '在庫あり' | '貸出中' | '予約待ち'
}

const rows: Book[] = [
  { bookId: 'B-000128', title: '銀河鉄道の夜', author: '宮沢 賢治', genre: '文学', state: '在庫あり' },
  { bookId: 'B-000129', title: '日本語の作文技術', author: '本多 勝一', genre: '人文', state: '貸出中' },
  { bookId: 'B-000130', title: '統計学が最強の学問である', author: '西内 啓', genre: '社会科学', state: '予約待ち' },
  { bookId: 'B-000131', title: 'つくられた縄文時代', author: '山田 康弘', genre: '人文', state: '在庫あり' },
]

const stateVariant = {
  在庫あり: 'success',
  貸出中: 'info',
  予約待ち: 'warning',
} as const

const columns: TableColumn<Book>[] = [
  { key: 'bookId', header: '書籍ID', render: (r) => r.bookId, mono: true, width: '8rem' },
  { key: 'title', header: 'タイトル', render: (r) => r.title },
  { key: 'author', header: '著者', render: (r) => r.author, width: '10rem' },
  { key: 'genre', header: 'ジャンル', render: (r) => <Badge variant="outline">{r.genre}</Badge>, width: '8rem' },
  {
    key: 'state',
    header: '状態',
    render: (r) => (
      <Badge variant={stateVariant[r.state]} dot>
        {r.state}
      </Badge>
    ),
    width: '8rem',
  },
  {
    key: 'actions',
    header: '操作',
    align: 'right',
    width: '8rem',
    render: () => (
      <Button variant="ghost" size="sm" iconLeft="edit">
        編集
      </Button>
    ),
  },
]

const meta: Meta<typeof Table> = {
  title: 'UI/Table',
  component: Table,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof Table>

export const Default: Story = {
  render: () => (
    <Table columns={columns} rows={rows} rowKey={(r) => r.bookId} caption="蔵書管理台帳" />
  ),
}

export const Empty: Story = {
  render: () => (
    <Table
      columns={columns}
      rows={[]}
      rowKey={(r) => r.bookId}
      caption="蔵書管理台帳"
      empty={
        <EmptyState
          icon="book"
          title="該当する蔵書がありません"
          description="検索条件を変えて、もう一度お試しください。"
        />
      }
    />
  ),
}
