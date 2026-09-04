import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ErrorAlert } from '@/components/common/ErrorAlert'

const meta: Meta<typeof ErrorAlert> = {
  title: 'Common/ErrorAlert',
  component: ErrorAlert,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ErrorAlert>

export const Forbidden: Story = {
  args: { error: { kind: 'forbidden', message: 'この画面を表示する権限がありません' } },
}

export const Validation: Story = {
  args: { error: { kind: 'validation', message: '入力内容を確認してください', fieldErrors: { title: 'タイトルは必須です' } } },
}

export const Conflict: Story = {
  args: { error: { kind: 'conflict', message: '他の司書が更新しました' }, onReload: () => {} },
}

export const ServerWithRetry: Story = {
  args: { error: { kind: 'server', message: '書籍を登録できませんでした。しばらくしてからもう一度お試しください' }, onRetry: () => {} },
}

export const BusinessStaffAudience: Story = {
  args: { error: { kind: 'business', message: '貸出できません: 貸出上限（5冊）に達しています', reasonCode: 'LOAN_LIMIT_EXCEEDED' }, audience: 'staff' },
}
