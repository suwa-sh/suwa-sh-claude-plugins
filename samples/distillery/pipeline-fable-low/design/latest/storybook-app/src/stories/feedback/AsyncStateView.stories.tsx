import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AsyncStateView } from '@/components/common/AsyncStateView'
import { Card, CardHeader } from '@/components/ui/Card'

const meta: Meta<typeof AsyncStateView> = {
  title: 'Common/AsyncStateView',
  component: AsyncStateView,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof AsyncStateView>

const Content = () => (
  <Card>
    <CardHeader title="取得したコンテンツ" description="loading=false / error=null / empty=false のときに表示される" />
  </Card>
)

export const Loading: Story = {
  render: () => (
    <AsyncStateView loading error={null} empty={false} skeleton={{ variant: 'table', count: 5 }} emptyState={{ title: '該当なし' }} delayMs={0}>
      <Content />
    </AsyncStateView>
  ),
}

export const Empty: Story = {
  render: () => (
    <AsyncStateView
      loading={false}
      error={null}
      empty
      skeleton={{ variant: 'table' }}
      emptyState={{ title: '該当する書籍が見つかりません', description: '検索条件を変更してください', action: { label: '検索条件をクリア', onClick: () => {} } }}
    >
      <Content />
    </AsyncStateView>
  ),
}

export const Error: Story = {
  render: () => (
    <AsyncStateView
      loading={false}
      error={{ kind: 'server', message: '書籍情報を取得できませんでした。しばらくしてからもう一度お試しください' }}
      empty={false}
      skeleton={{ variant: 'table' }}
      emptyState={{ title: '該当なし' }}
      onRetry={() => {}}
    >
      <Content />
    </AsyncStateView>
  ),
}

export const WithContent: Story = {
  render: () => (
    <AsyncStateView loading={false} error={null} empty={false} skeleton={{ variant: 'table' }} emptyState={{ title: '該当なし' }}>
      <Content />
    </AsyncStateView>
  ),
}
