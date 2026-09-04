import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Pagination } from './Pagination'

const meta: Meta<typeof Pagination> = {
  title: 'UI/Pagination',
  component: Pagination,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Pagination>

export const Default: Story = {
  render: function Render() {
    const [page, setPage] = useState(2)
    return <Pagination page={page} total={187} onChange={setPage} />
  },
}
export const SinglePage: Story = { args: { page: 1, total: 12, onChange: () => undefined } }
