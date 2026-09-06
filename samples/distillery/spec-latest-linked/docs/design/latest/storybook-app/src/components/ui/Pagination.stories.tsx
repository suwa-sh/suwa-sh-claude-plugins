import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Pagination } from './Pagination'

const meta: Meta<typeof Pagination> = {
  title: 'UI/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'NFR B.1.1.1（同時アクセス 〜100 / 登録利用者 〜1,000）の規模では仮想スクロールは不要と判断し、20 件/頁のページネーションで一覧を分割する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof Pagination>

const Wrapper: React.FC<{ totalPages: number; totalCount: number; start?: number }> = ({
  totalPages,
  totalCount,
  start = 1,
}) => {
  const [page, setPage] = React.useState(start)
  return (
    <Pagination page={page} totalPages={totalPages} onChange={setPage} totalCount={totalCount} />
  )
}

export const Default: Story = { render: () => <Wrapper totalPages={7} totalCount={128} /> }
export const MiddlePage: Story = { render: () => <Wrapper totalPages={24} totalCount={472} start={12} /> }
export const SinglePage: Story = { render: () => <Wrapper totalPages={1} totalCount={8} /> }
