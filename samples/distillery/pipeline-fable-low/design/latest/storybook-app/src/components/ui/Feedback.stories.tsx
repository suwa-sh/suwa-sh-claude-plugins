import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Alert, EmptyState, LoadingBlock, SkeletonCard, SkeletonTable, Spinner } from './Feedback'
import { Button } from './Button'

const meta: Meta = {
  title: 'UI/Feedback',
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj

export const Alerts: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 12, maxWidth: 560 }}>
      <Alert tone="info" title="貸出できます">内容を確認して「貸出を確定する」を押してください</Alert>
      <Alert tone="success" title="返却を登録しました">書籍の状態は「在庫あり」になりました</Alert>
      <Alert tone="warning" title="予約者がいます">返却後は「予約待ち」になり、予約順位 1 位の利用者へ返却通知を送信します</Alert>
      <Alert tone="destructive" title="貸出できません" action={<Button size="sm" variant="outline">予約一覧</Button>}>この書籍は貸出中です</Alert>
    </div>
  ),
}
export const Empty: Story = {
  render: () => <EmptyState icon="search" title="該当する書籍がありません" description="検索条件を変えて、もう一度お試しください" action={<Button variant="outline" icon="rotate-ccw">条件をクリア</Button>} />,
}
export const Skeletons: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 24, maxWidth: 640 }}>
      <SkeletonTable rows={4} cols={5} />
      <SkeletonCard />
    </div>
  ),
}
export const Spinners: Story = {
  render: () => (
    <div className="flex items-center" style={{ gap: 24 }}>
      <Spinner size="sm" />
      <Spinner size="md" />
      <Spinner size="lg" />
      <LoadingBlock message="集計中です…" />
    </div>
  ),
}
