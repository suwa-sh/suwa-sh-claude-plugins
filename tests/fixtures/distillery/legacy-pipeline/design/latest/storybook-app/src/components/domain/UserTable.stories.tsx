import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from '../ui/Button'
import { UserTable } from './UserTable'
import type { User } from './UserTable'

const meta = {
  title: 'Domain/UserTable',
  component: UserTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof UserTable>

export default meta
type Story = StoryObj<typeof meta>

const users: User[] = [
  {
    userNumber: 'U-2024-000318',
    name: '高瀬 由紀子',
    email: 'takase.yukiko@example.jp',
    category: '一般',
    state: '登録済み',
    activeLoans: 2,
    activeReservations: 1,
  },
  {
    userNumber: 'U-2023-001204',
    name: '南部 圭介',
    email: 'nambu.keisuke@example.jp',
    category: '学生',
    state: '取引進行中',
    activeLoans: 5,
    activeReservations: 3,
  },
  {
    userNumber: 'U-2022-000087',
    name: '緑川 図書研究会',
    email: 'midorikawa.lib@example.jp',
    category: '団体',
    state: '登録済み',
    activeLoans: 0,
    activeReservations: 0,
  },
  {
    userNumber: 'U-2025-000042',
    name: '伊佐野 千歳',
    email: 'isano.chitose@example.jp',
    category: '一般',
    state: '取引進行中',
    activeLoans: 1,
    activeReservations: 0,
  },
]

export const Default: Story = {
  args: {
    users,
    actionsFor: () => (
      <>
        <Button variant="ghost" size="sm" iconLeft="id-card">
          詳細
        </Button>
        <Button variant="outline" size="sm" iconLeft="edit">
          変更
        </Button>
      </>
    ),
  },
}

export const Loading: Story = {
  args: { users: [], loading: true },
}

export const Empty: Story = {
  args: { users: [] },
}

export const Error: Story = {
  args: {
    users: [],
    error: '利用者管理サービスに接続できませんでした。時間をおいて再度お試しください。',
  },
}
