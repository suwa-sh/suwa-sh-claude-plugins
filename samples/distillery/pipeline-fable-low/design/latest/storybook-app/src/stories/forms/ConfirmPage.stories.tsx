import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ConfirmPage } from '@/components/common/ConfirmPage'

const meta: Meta<typeof ConfirmPage> = {
  title: 'Common/ConfirmPage',
  component: ConfirmPage,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof ConfirmPage>

const Summary = ({ rows }: { rows: { label: string; value: string }[] }) => (
  <dl className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
    {rows.map((r) => (
      <div key={r.label} className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
        <dt style={{ color: 'var(--foreground-secondary)' }}>{r.label}</dt>
        <dd>{r.value}</dd>
      </div>
    ))}
  </dl>
)

export const DestructiveConfirm: Story = {
  render: () => (
    <ConfirmPage
      title="書籍を削除しますか"
      tone="destructive"
      blocked={false}
      summary={<Summary rows={[{ label: 'タイトル', value: '吾輩は猫である' }, { label: '書籍 ID', value: 'B-000101' }]} />}
      impact="この操作は取り消せません"
      loading={false}
      loadError={null}
      emptyState={{ title: '対象の書籍が見つかりません' }}
      submitting={false}
      confirmLabel="削除する"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  ),
}

export const Blocked: Story = {
  render: () => (
    <ConfirmPage
      title="書籍を削除しますか"
      tone="destructive"
      blocked
      summary={<Summary rows={[{ label: 'タイトル', value: 'リーダブルコード' }, { label: '書籍 ID', value: 'B-000102' }]} />}
      impact="貸出中のため削除できません"
      loading={false}
      loadError={null}
      emptyState={{ title: '対象の書籍が見つかりません' }}
      submitting={false}
      confirmLabel="削除する"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  ),
}

export const PrimaryConfirmWithDoneActions: Story = {
  render: () => (
    <ConfirmPage
      title="予約を申し込みます"
      tone="primary"
      blocked={false}
      summary={<Summary rows={[{ label: 'タイトル', value: 'サピエンス全史（上）' }, { label: '順番', value: '2 番目' }]} />}
      impact="予約が確定すると取消は「マイ予約状況」から行えます"
      loading={false}
      loadError={null}
      emptyState={{ title: '対象の書籍が見つかりません' }}
      submitting={false}
      confirmLabel="予約を確定"
      onConfirm={() => {}}
      onCancel={() => {}}
      doneActions={[{ label: 'マイ予約状況を見る', onClick: () => {}, variant: 'default' }, { label: '検索結果へ戻る', onClick: () => {}, variant: 'secondary' }]}
    />
  ),
}
