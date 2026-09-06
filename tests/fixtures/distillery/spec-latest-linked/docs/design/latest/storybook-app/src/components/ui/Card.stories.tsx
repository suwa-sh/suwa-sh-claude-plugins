import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card, CardHeader } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'

const meta: Meta<typeof Card> = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}
export default meta
type Story = StoryObj<typeof Card>

export const Default: Story = {
  render: () => (
    <Card style={{ maxWidth: '32rem' }}>
      <CardHeader
        title="貸出内容"
        description="返却期限は貸出期間区分から自動設定されます"
        actions={<Badge variant="info" icon="book-open">貸出中</Badge>}
      />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
        『銀河鉄道の夜』 宮沢賢治 / 岩波書店
      </p>
    </Card>
  ),
}

export const Hoverable: Story = {
  render: () => (
    <Card hoverable style={{ maxWidth: '32rem' }}>
      <CardHeader title="蔵書検索結果" description="クリックで書籍詳細へ" />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
        該当 128 件
      </p>
    </Card>
  ),
}

export const WithActions: Story = {
  render: () => (
    <Card style={{ maxWidth: '32rem' }}>
      <CardHeader
        title="利用者情報"
        description="個人情報は業務上必要な範囲のみ表示します"
        actions={
          <>
            <Button variant="ghost" size="sm" iconLeft="edit">
              編集
            </Button>
            <Button variant="outline" size="sm">
              退会手続
            </Button>
          </>
        }
      />
      <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
        利用者番号 U-2026-0184 / 一般
      </p>
    </Card>
  ),
}

export const Flush: Story = {
  render: () => (
    <Card flush style={{ maxWidth: '32rem' }}>
      <div style={{ padding: 'var(--card-padding)' }}>
        <CardHeader title="蔵書管理台帳" />
      </div>
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: 'var(--card-padding)',
          background: 'var(--background-subtle)',
          fontSize: 'var(--font-size-sm)',
          color: 'var(--foreground-secondary)',
        }}
      >
        テーブルをそのまま入れる場合は `flush` で内側余白を外す
      </div>
    </Card>
  ),
}
