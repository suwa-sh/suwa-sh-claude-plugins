import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Button } from '@/components/ui/Button'

const meta: Meta<typeof AsyncSection> = {
  title: 'Common/AsyncSection',
  component: AsyncSection,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '一覧系画面が同じ順序・同じ位置で 3 状態（Skeleton / EmptyState / Alert(destructive)）を出すための型（Skeleton + EmptyState + Alert の合成）。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof AsyncSection>

export const Loading: Story = {
  args: { loading: true, error: null, isEmpty: false, skeleton: 'table', emptyMessage: '', children: null },
}

export const Empty: Story = {
  args: {
    loading: false,
    error: null,
    isEmpty: true,
    emptyTitle: '条件に一致する書籍がありません',
    emptyMessage: '検索条件を変更して再度お試しください',
    emptyAction: <Button variant="outline">条件をクリアする</Button>,
    children: null,
  },
}

export const ErrorState: Story = {
  args: {
    loading: false,
    error: '通信エラーが発生しました。しばらくしてから再試行してください。',
    isEmpty: false,
    emptyMessage: '',
    onRetry: () => {},
    children: null,
  },
}

export const Ready: Story = {
  args: {
    loading: false,
    error: null,
    isEmpty: false,
    readyCount: 3,
    emptyMessage: '',
    children: (
      <p style={{ fontSize: 'var(--font-size-sm)' }}>3 件の検索結果（children スロット）</p>
    ),
  },
}
