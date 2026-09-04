import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { BackLink } from '@/components/common/BackLink'

const meta: Meta<typeof BackLink> = {
  title: 'Common/BackLink',
  component: BackLink,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof BackLink>

export const Simple: Story = {
  args: { label: '検索結果へ戻る', to: '/search' },
}

export const WithReturnQuery: Story = {
  args: { label: '蔵書一覧へ戻る', to: '/staff/books', returnQuery: { page: 2, q: '夏目' }, replace: true },
}
