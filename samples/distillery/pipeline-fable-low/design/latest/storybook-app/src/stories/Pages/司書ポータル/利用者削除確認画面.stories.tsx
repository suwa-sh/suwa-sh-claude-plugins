import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { ConfirmPage } from '@/components/common/ConfirmPage'
import { PiiMaskedText } from '@/components/domain/PiiMaskedText'
import { sampleUsers } from '@/components/domain/sampleData'
import type { User } from '@/components/domain/types'

const Summary: React.FC<{ user: User }> = ({ user }) => (
  <dl className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>利用者番号</dt>
      <dd style={{ fontFamily: 'var(--font-family-mono)' }}>{user.number}</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>氏名</dt>
      <dd>{user.name}</dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>メールアドレス</dt>
      <dd>
        <PiiMaskedText value={user.email} kind="email" />
      </dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>電話番号</dt>
      <dd>
        <PiiMaskedText value={user.phone} kind="phone" />
      </dd>
    </div>
    <div className="flex items-center justify-between" style={{ gap: 'var(--spacing-3)', fontSize: 'var(--font-size-sm)' }}>
      <dt style={{ color: 'var(--foreground-secondary)' }}>住所</dt>
      <dd>
        <PiiMaskedText value={user.address} kind="address" />
      </dd>
    </div>
  </dl>
)

interface UserDeletePageProps {
  user: User
  deletable: boolean
  impact: string
}

/** 利用者削除確認画面（/staff/users/:userId/delete）。ConfirmPage を destructive / blocked で表示する。 */
const UserDeletePage: React.FC<UserDeletePageProps> = ({ user, deletable, impact }) => (
  <StaffLayout activeGroup="users" activeItem="userDelete" userName="佐藤 花子">
    <ConfirmPage
      title="利用者を削除しますか"
      tone="destructive"
      blocked={!deletable}
      summary={<Summary user={user} />}
      impact={impact}
      loading={false}
      loadError={null}
      emptyState={{ title: '利用者が見つかりません' }}
      submitting={false}
      confirmLabel="削除する"
      onConfirm={() => {}}
      onCancel={() => {}}
    />
  </StaffLayout>
)

const meta: Meta<typeof UserDeletePage> = {
  title: 'Pages/司書ポータル/利用者削除確認画面',
  component: UserDeletePage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UserDeletePage>

export const Deletable: Story = {
  render: () => <UserDeletePage user={sampleUsers[2]} deletable impact="この操作は取り消せません。過去の貸出履歴は保持されます" />,
}

export const Blocked: Story = {
  render: () => <UserDeletePage user={sampleUsers[0]} deletable={false} impact="貸出中の書籍が 2 冊あるため削除できません" />,
}
