import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Button } from './Button'
import { Card, CardHeader } from './Card'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card style={{ maxWidth: 480 }}>
      <CardHeader title="書籍情報" description="蔵書として登録する書籍の情報を入力します" action={<Button size="sm" variant="outline" icon="edit">編集</Button>} />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>カードはコンテンツのまとまりを示す基本コンテナです。padding は card-padding トークン（1.5rem）を使います。</p>
    </Card>
  ),
}
export const Hoverable: Story = {
  render: () => (
    <Card variant="hoverable" style={{ maxWidth: 480 }} onClick={() => undefined}>
      <CardHeader title="吾輩は猫である" description="夏目漱石 / 新潮社" />
    </Card>
  ),
}
export const Flush: Story = {
  render: () => (
    <Card variant="flush" style={{ maxWidth: 480 }}>
      <div style={{ padding: 'var(--spacing-4)', background: 'var(--table-header-bg)', fontWeight: 600 }}>ヘッダー領域</div>
      <div style={{ padding: 'var(--spacing-4)' }}>テーブルなどを端まで敷き詰めるときに使います。</div>
    </Card>
  ),
}
