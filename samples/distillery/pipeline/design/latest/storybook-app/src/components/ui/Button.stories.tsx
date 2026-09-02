import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '全アクションの基本要素。`loading` は arch SR-002（冪等キー付与と二重送信防止）に対応し、送信中はクリックを受け付けない。',
      },
    },
  },
  args: { children: '貸出を登録' },
}
export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {}
export const Secondary: Story = { args: { variant: 'secondary', children: 'キャンセル' } }
export const Outline: Story = { args: { variant: 'outline', children: '条件をリセット' } }
export const Ghost: Story = { args: { variant: 'ghost', children: '詳細を見る' } }
export const Destructive: Story = {
  args: { variant: 'destructive', children: '除籍する', iconLeft: 'trash' },
}
export const WithIcon: Story = { args: { iconLeft: 'search', children: '蔵書を検索' } }
export const Loading: Story = { args: { loading: true, children: '送信中' } }
export const Disabled: Story = { args: { disabled: true, children: '貸出できません' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      {(['sm', 'md', 'lg'] as const).map((size) => (
        <div key={size} className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
          <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
            size = {size}
          </span>
          <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
            <Button size={size}>登録する</Button>
            <Button size={size} variant="secondary">
              戻る
            </Button>
            <Button size={size} variant="outline">
              条件をリセット
            </Button>
            <Button size={size} variant="ghost">
              詳細
            </Button>
            <Button size={size} variant="destructive" iconLeft="trash">
              除籍する
            </Button>
            <Button size={size} loading>
              送信中
            </Button>
          </div>
        </div>
      ))}
    </div>
  ),
}
