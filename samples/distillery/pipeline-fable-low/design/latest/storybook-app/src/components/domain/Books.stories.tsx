import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BookSearchFilter, emptySearch, type BookSearchValue } from './BookSearchFilter'
import { BookCard } from './BookCard'
import { BookTable } from './BookTable'
import { BookForm } from './Forms'
import { sampleBooks } from './sampleData'

const meta: Meta = {
  title: 'Domain/Books',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const SearchFilterPatron: Story = {
  render: function Render() {
    const [v, setV] = useState<BookSearchValue>(emptySearch)
    return (
      <div style={{ maxWidth: 720 }}>
        <BookSearchFilter value={v} onChange={setV} variant="patron" />
      </div>
    )
  },
}
export const SearchFilterStaff: Story = {
  render: function Render() {
    const [v, setV] = useState<BookSearchValue>({ ...emptySearch, states: ['在庫あり'] })
    return (
      <div style={{ maxWidth: 960 }}>
        <BookSearchFilter value={v} onChange={setV} variant="staff" compact />
      </div>
    )
  },
}
export const SearchFilterGenre: Story = {
  render: function Render() {
    const [v, setV] = useState<BookSearchValue>({ ...emptySearch, kind: 'ジャンル', genres: ['文学'] })
    return (
      <div style={{ maxWidth: 720 }}>
        <BookSearchFilter value={v} onChange={setV} />
      </div>
    )
  },
}
export const CardCompact: Story = {
  render: () => (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 12, maxWidth: 900 }}>
      {sampleBooks.slice(0, 4).map((b) => (
        <BookCard key={b.id} book={b} onSelect={() => undefined} />
      ))}
    </div>
  ),
}
export const CardDetail: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 16, maxWidth: 800 }}>
      <BookCard book={sampleBooks[1]} variant="detail" onReserve={() => undefined} />
      <BookCard book={sampleBooks[0]} variant="detail" onReserve={() => undefined} />
    </div>
  ),
}
export const TableManage: Story = { render: () => <BookTable books={sampleBooks} onEdit={() => undefined} onDelete={() => undefined} /> }
export const TableInventory: Story = { render: () => <BookTable books={sampleBooks} variant="inventory" /> }
export const TableLoading: Story = { render: () => <BookTable books={[]} loading /> }
export const TableEmpty: Story = { render: () => <BookTable books={[]} /> }
export const FormCreate: Story = { render: () => <div style={{ maxWidth: 720 }}><BookForm mode="create" /></div> }
export const FormEditWithErrors: Story = {
  render: () => (
    <div style={{ maxWidth: 720 }}>
      <BookForm mode="edit" initial={{ ...sampleBooks[1], isbn: '978' }} errors={{ isbn: 'ISBN は 13 桁で入力してください' }} />
    </div>
  ),
}
export const FormSubmitting: Story = { render: () => <div style={{ maxWidth: 720 }}><BookForm mode="create" initial={sampleBooks[0]} submitting /></div> }
