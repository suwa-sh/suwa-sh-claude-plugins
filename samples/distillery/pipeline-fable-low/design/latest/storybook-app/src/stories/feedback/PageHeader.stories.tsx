import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PageHeader } from '@/components/common/PageHeader'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { NoticeAlert } from '@/components/common/NoticeAlert'

const meta: Meta<typeof PageHeader> = {
  title: 'Common/PageHeader',
  component: PageHeader,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof PageHeader>

export const Simple: Story = {
  render: () => <PageHeader title="蔵書検索" />,
}

export const WithStatusAndAction: Story = {
  render: () => (
    <PageHeader
      title="リーダブルコード"
      subtitle="書籍 ID: B-000102"
      status={<BookStatusBadge state="貸出中" />}
      primaryAction={{ label: '書籍を編集', onClick: () => {}, icon: 'edit' }}
      back={{ label: '蔵書一覧へ戻る', onClick: () => {} }}
    />
  ),
}

export const WithNotice: Story = {
  render: () => (
    <PageHeader
      title="蔵書一覧"
      primaryAction={{ label: '書籍を登録', onClick: () => {}, icon: 'plus' }}
      notices={<NoticeAlert notice="created" messages={{ created: '書籍を登録しました' }} onDismiss={() => {}} />}
    />
  ),
}
