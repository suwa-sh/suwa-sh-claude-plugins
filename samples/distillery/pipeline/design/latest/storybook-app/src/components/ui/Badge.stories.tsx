import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '状態表示専用のラベル。クリックできる選択肢には使わない（フィルターは `ToggleGroup` を使う）。色だけに依存しないよう `dot` か `icon` を併用する。',
      },
    },
  },
  args: { children: '在庫あり' },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = { args: { variant: 'default', children: '標準' } }
export const Success: Story = { args: { variant: 'success', icon: 'check-circle', children: '在庫あり' } }
export const Info: Story = { args: { variant: 'info', icon: 'book-open', children: '貸出中' } }
export const Warning: Story = { args: { variant: 'warning', icon: 'bookmark', children: '予約待ち' } }
export const Destructive: Story = {
  args: { variant: 'destructive', icon: 'alert-triangle', children: '延滞' },
}
export const Neutral: Story = { args: { variant: 'neutral', children: '返却済み' } }
export const Pending: Story = { args: { variant: 'pending', icon: 'clock', children: '期限接近' } }
export const Analysis: Story = { args: { variant: 'analysis', icon: 'refresh-cw', children: '集計中' } }
export const Outline: Story = { args: { variant: 'outline', children: '紙書籍' } }

export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
        <Badge variant="default">標準</Badge>
        <Badge variant="success" icon="check-circle">
          在庫あり
        </Badge>
        <Badge variant="info" icon="book-open">
          貸出中
        </Badge>
        <Badge variant="warning" icon="bookmark">
          予約待ち
        </Badge>
        <Badge variant="destructive" icon="alert-triangle">
          延滞
        </Badge>
        <Badge variant="neutral">返却済み</Badge>
        <Badge variant="pending" icon="clock">
          期限接近
        </Badge>
        <Badge variant="analysis" icon="refresh-cw">
          集計中
        </Badge>
        <Badge variant="outline">紙書籍</Badge>
      </div>
      <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-2)' }}>
        <Badge variant="success" dot>
          在庫あり
        </Badge>
        <Badge variant="info" dot>
          貸出中
        </Badge>
        <Badge variant="warning" dot>
          予約待ち
        </Badge>
        <Badge variant="destructive" dot>
          延滞
        </Badge>
        <Badge variant="neutral" dot>
          返却済み
        </Badge>
      </div>
    </div>
  ),
}
