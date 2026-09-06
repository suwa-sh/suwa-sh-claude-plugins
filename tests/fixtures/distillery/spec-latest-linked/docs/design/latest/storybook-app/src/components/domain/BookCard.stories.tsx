import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BookCard } from './BookCard'
import type { BookSummary } from './BookCard'
import { Button } from '../ui/Button'

const baseBook: BookSummary = {
  bookId: 'BK-000123',
  title: '静かな図書館の午後',
  author: '橘 咲希',
  isbn: '978-4-1234-5678-9',
  publisher: '青葉書房',
  genre: '文学',
  materialType: '紙書籍',
  state: '在庫あり',
}

const meta = {
  title: 'Domain/BookCard',
  component: BookCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof BookCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    book: baseBook,
    reservationCount: 0,
    actions: (
      <Button size="sm" iconLeft="bookmark">
        予約する
      </Button>
    ),
  },
}

export const OnLoan: Story = {
  args: {
    book: {
      ...baseBook,
      bookId: 'BK-000456',
      title: 'データ指向アプリケーションの設計',
      author: '森下 亮太',
      isbn: '978-4-8765-4321-0',
      publisher: '技術評論舎',
      genre: '技術',
      state: '貸出中',
    },
    reservationCount: 1,
  },
}

export const Reserved: Story = {
  args: {
    book: {
      ...baseBook,
      bookId: 'BK-000789',
      title: '夜明けの植物図鑑',
      author: '小田切 みなも',
      isbn: '978-4-2468-1357-2',
      publisher: '白鷺出版',
      genre: '自然科学',
      state: '予約待ち',
    },
    reservationCount: 3,
  },
}

export const LongTitle: Story = {
  args: {
    book: {
      ...baseBook,
      bookId: 'BK-001024',
      title:
        '図書館情報システムにおける蔵書管理と貸出予約業務の統合設計に関する実践的アプローチ 第3版 改訂増補',
      author: '長谷川 真知子・久保田 誠一郎・ヴィクトリア=アレクサンドラ 御堂筋 共著',
      isbn: '978-4-9999-0000-1',
      publisher: '日本図書館情報学研究会出版部',
      genre: '社会科学',
      state: '在庫あり',
    },
    reservationCount: 12,
  },
}

export const Grid: Story = {
  args: { book: baseBook },
  render: () => (
    <div
      className="grid grid-cols-1 md:grid-cols-3"
      style={{ gap: 'var(--component-gap)' }}
    >
      <BookCard book={baseBook} reservationCount={0} />
      <BookCard
        book={{
          ...baseBook,
          bookId: 'BK-000456',
          title: 'データ指向アプリケーションの設計',
          author: '森下 亮太',
          isbn: '978-4-8765-4321-0',
          publisher: '技術評論舎',
          genre: '技術',
          state: '貸出中',
        }}
        reservationCount={1}
      />
      <BookCard
        book={{
          ...baseBook,
          bookId: 'BK-000789',
          title: '夜明けの植物図鑑',
          author: '小田切 みなも',
          isbn: '978-4-2468-1357-2',
          publisher: '白鷺出版',
          genre: '自然科学',
          state: '予約待ち',
        }}
        reservationCount={3}
      />
    </div>
  ),
}
