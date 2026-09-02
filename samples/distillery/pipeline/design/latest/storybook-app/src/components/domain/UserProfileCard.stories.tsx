import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '../ui/Button'
import { UserProfileCard } from './UserProfileCard'

const meta = {
  title: 'Domain/UserProfileCard',
  component: UserProfileCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof UserProfileCard>

export default meta
type Story = StoryObj<typeof meta>

const user = {
  userNumber: 'U-2024-000318',
  name: '高瀬 由紀子',
  email: 'takase.yukiko@example.jp',
  category: '一般',
  state: '登録済み' as const,
  registeredAt: '2024-05-12',
}

export const Default: Story = {
  args: { user },
}

export const Revealed: Story = {
  args: { user, maskContact: false },
}

export const InTransaction: Story = {
  args: {
    user: {
      ...user,
      userNumber: 'U-2023-001204',
      name: '南部 圭介',
      email: 'nambu.keisuke@example.jp',
      category: '学生',
      state: '取引進行中',
      registeredAt: '2023-11-02',
    },
  },
}

export const WithActions: Story = {
  args: {
    user,
    actions: (
      <>
        <Button variant="default" size="sm" iconLeft="edit">
          登録内容を変更
        </Button>
        <Button variant="outline" size="sm" iconLeft="log-out">
          退会手続へ
        </Button>
      </>
    ),
  },
}
