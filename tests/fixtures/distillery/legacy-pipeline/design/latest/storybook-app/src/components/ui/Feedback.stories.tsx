import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Alert, EmptyState, Skeleton, SkeletonCard, SkeletonDetail, SkeletonTable, Spinner } from './Feedback'
import { Button } from './Button'

const meta: Meta = {
  title: 'UI/Feedback',
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          'NFR A（可用性）と B.2.1.1（レスポンス 5 秒以内）に対応する状態表示。一覧・詳細コンポーネントは Loading / Empty / Error の 3 状態を必ず持つ。',
      },
    },
  },
}
export default meta
type Story = StoryObj

export const Alerts: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
      <Alert tone="info" title="取置き期限は 3 日間です">
        期限を過ぎると次の順位の方へ取置きが移ります。
      </Alert>
      <Alert tone="success" title="返却を登録しました">
        『銀河鉄道の夜』の返却を受け付けました。
      </Alert>
      <Alert
        tone="warning"
        title="2 件の通知が未達です"
        actions={
          <Button variant="outline" size="sm" iconLeft="refresh-cw">
            再送する
          </Button>
        }
      >
        メール配信サービスとの連携に失敗しました。
      </Alert>
      <Alert tone="destructive" title="この書籍は削除できません">
        貸出中または予約待ちの書籍は、蔵書削除制限ポリシーにより除籍できません。
      </Alert>
    </div>
  ),
}

export const Empty: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <EmptyState
        icon="book"
        title="該当する蔵書がありません"
        description="キーワードやジャンルの条件を変えて、もう一度お試しください。"
        action={
          <Button variant="outline" size="sm">
            条件をリセット
          </Button>
        }
      />
      <EmptyState icon="chart-bar" title="対象期間に貸出実績がありません" description="集計期間を広げてください。" />
    </div>
  ),
}

export const Loading: Story = {
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
        <Skeleton width="12rem" height="1.5rem" />
        <Skeleton width="20rem" />
        <Skeleton width="16rem" />
      </div>
      <SkeletonTable rows={5} cols={5} />
    </div>
  ),
}

export const LoadingSkeletonVariants: Story = {
  name: 'Loading / Skeleton variants',
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <section className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>card（カード一覧の取得）</h3>
        <SkeletonCard count={2} />
      </section>
      <section className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
        <h3 style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600 }}>detail（詳細の取得）</h3>
        <SkeletonDetail rows={4} />
      </section>
    </div>
  ),
}

export const LoadingSpinner: Story = {
  name: 'Loading / Spinner',
  render: () => (
    <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
      <div className="flex items-center" style={{ gap: 'var(--spacing-6)' }}>
        <Spinner size="sm" label="検索中" showLabel />
        <Spinner size="md" label="再取得中" showLabel />
        <Spinner size="lg" label="集計中" showLabel />
      </div>
      <div
        style={{
          position: 'relative',
          minHeight: '10rem',
          border: '1px solid var(--card-border)',
          borderRadius: 'var(--card-radius)',
          background: 'var(--card-bg)',
          padding: 'var(--card-padding)',
        }}
      >
        <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
          <Skeleton width="40%" height="1.25rem" />
          <Skeleton />
          <Skeleton width="70%" />
        </div>
        <Spinner variant="overlay" size="lg" label="確定処理中です" />
      </div>
    </div>
  ),
}
