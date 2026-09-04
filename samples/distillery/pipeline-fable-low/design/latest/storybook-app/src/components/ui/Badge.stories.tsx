import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Badge } from './Badge'

const meta: Meta<typeof Badge> = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: '在庫あり', variant: 'success' },
}
export default meta
type Story = StoryObj<typeof Badge>

export const Default: Story = {}
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
      <Badge variant="default">既定</Badge>
      <Badge variant="success" icon="check-circle">在庫あり</Badge>
      <Badge variant="info" icon="book-open">貸出中</Badge>
      <Badge variant="pending" icon="bookmark">予約待ち</Badge>
      <Badge variant="warning" icon="clock">予約中</Badge>
      <Badge variant="analysis" icon="mail-check">通知済み</Badge>
      <Badge variant="destructive" icon="alert-triangle">延滞</Badge>
      <Badge variant="neutral">返却済み</Badge>
      <Badge variant="outline" icon="tag">文学</Badge>
    </div>
  ),
}
export const WithDot: Story = {
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 8 }}>
      <Badge variant="success" dot>在庫あり</Badge>
      <Badge variant="info" dot>貸出中</Badge>
      <Badge variant="pending" dot>予約待ち</Badge>
    </div>
  ),
}
