import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import React from 'react'
import { BookSearchFilter } from './BookSearchFilter'
import type { BookSearchFilterValue } from './BookSearchFilter'

const meta: Meta<typeof BookSearchFilter> = {
  title: 'Domain/BookSearchFilter',
  component: BookSearchFilter,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof meta>

const emptyValue: BookSearchFilterValue = {
  keyword: '',
  conditionType: [],
  genres: [],
  materialTypes: [],
  inStockOnly: false,
}

const Stateful: React.FC<{
  initial: BookSearchFilterValue
  resultCount?: number
}> = ({ initial, resultCount }) => {
  const [value, setValue] = React.useState<BookSearchFilterValue>(initial)
  return (
    <BookSearchFilter
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      resultCount={resultCount}
    />
  )
}

export const Default: Story = {
  render: () => <Stateful initial={emptyValue} />,
}

export const WithSelection: Story = {
  render: () => (
    <Stateful
      initial={{
        keyword: '図書館',
        conditionType: ['タイトル'],
        genres: ['文学', '社会科学'],
        materialTypes: ['紙書籍'],
        inStockOnly: true,
      }}
      resultCount={42}
    />
  ),
}

export const NoResult: Story = {
  render: () => (
    <Stateful
      initial={{
        keyword: '存在しない書名キーワード',
        conditionType: ['ISBN'],
        genres: ['芸術'],
        materialTypes: [],
        inStockOnly: true,
      }}
      resultCount={0}
    />
  ),
}
