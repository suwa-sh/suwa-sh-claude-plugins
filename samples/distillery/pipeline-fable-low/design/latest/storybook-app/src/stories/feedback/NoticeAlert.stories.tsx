import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NoticeAlert } from '@/components/common/NoticeAlert'

const meta: Meta<typeof NoticeAlert> = {
  title: 'Common/NoticeAlert',
  component: NoticeAlert,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof NoticeAlert>

export const Created: Story = {
  args: { notice: 'created', messages: { created: '書籍を登録しました' }, onDismiss: () => {} },
}

export const Deleted: Story = {
  args: { notice: 'deleted', messages: { deleted: '利用者を削除しました' }, onDismiss: () => {} },
}

export const NoNotice: Story = {
  args: { notice: null, messages: {}, onDismiss: () => {} },
}
