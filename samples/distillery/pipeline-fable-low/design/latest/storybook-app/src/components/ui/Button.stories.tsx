import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './Button'

const meta: Meta<typeof Button> = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: '貸出を確定する' },
}
export default meta
type Story = StoryObj<typeof Button>

export const Default: Story = {}
export const Variants: Story = {
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
      <Button>登録する</Button>
      <Button variant="secondary">キャンセル</Button>
      <Button variant="outline" icon="arrow-left">戻る</Button>
      <Button variant="ghost" icon="edit">編集</Button>
      <Button variant="destructive" icon="trash">削除する</Button>
    </div>
  ),
}
export const Sizes: Story = {
  render: () => (
    <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
      <Button size="sm" icon="search">検索</Button>
      <Button size="md" icon="search">検索</Button>
      <Button size="lg" icon="check">貸出を確定する</Button>
    </div>
  ),
}
export const Loading: Story = { args: { loading: true, children: '送信中…' } }
export const Disabled: Story = { args: { disabled: true, children: '貸出できません' } }
