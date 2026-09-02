import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'

/**
 * 退会手続画面（/staff/users/:userNumber/withdraw）。
 * UC 固有コンポーネント WithdrawConfirmModal を、共通コンポーネント
 * PortalPageLayout + AsyncSection + ConfirmActionModal（destructive）+ SubmitActionButton の
 * 薄いアダプタとして実装する。削除可否はバックエンド API の応答（deletable）を表示するだけとする（LR-030）。
 */

interface WithdrawTarget {
  user: UserProfileCardUser
  deletable: boolean
  activeLoanCount: number
  activeReservationCount: number
}

const deletableTarget: WithdrawTarget = {
  user: {
    userNumber: 'U-000123',
    name: '田中太郎',
    email: 'tanaka@example.com',
    category: '一般',
    state: '登録済み',
    registeredAt: '2025-04-01',
  },
  deletable: true,
  activeLoanCount: 0,
  activeReservationCount: 0,
}

const nonDeletableTarget: WithdrawTarget = {
  user: {
    userNumber: 'U-000200',
    name: '鈴木一郎',
    email: 'suzuki@example.com',
    category: '一般',
    state: '取引進行中',
    registeredAt: '2024-11-10',
  },
  deletable: false,
  activeLoanCount: 1,
  activeReservationCount: 0,
}

interface ScreenProps {
  target: WithdrawTarget
  loading?: boolean
  error?: string | null
}

function WithdrawScreen({ target, loading = false, error = null }: ScreenProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const onConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setConfirmOpen(false)
      setDone(true)
    }, 600)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="退会手続"
      description="対象利用者の退会を手続きします。"
      breadcrumb={[{ label: '利用者名簿', href: '/staff/users' }, { label: '退会手続' }]}
      activeNavId="user"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の利用者が見つかりません"
        onRetry={() => {}}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          {done && <Alert tone="success" title="退会手続が完了しました">利用者名簿から削除されました。</Alert>}

          {!done && (
            <>
              <UserProfileCard
                user={target.user}
                maskContact
                actions={
                  <>
                    <Button variant="outline">キャンセル</Button>
                    <SubmitActionButton
                      idempotencyKey="44444444-4444-4444-8444-444444444444"
                      variant="destructive"
                      onSubmit={() => setConfirmOpen(true)}
                      submitting={submitting}
                      disabled={!target.deletable}
                    >
                      退会させる
                    </SubmitActionButton>
                  </>
                }
              />
              {!target.deletable && (
                <Alert tone="warning" title="進行中の取引があるため退会させられません">
                  進行中の貸出が {target.activeLoanCount} 件、進行中の予約が {target.activeReservationCount} 件あります。
                </Alert>
              )}
            </>
          )}
        </div>
      </AsyncSection>

      <ConfirmActionModal
        open={confirmOpen}
        tone="destructive"
        title="退会させますか"
        targetLabel={`${target.user.name}（${target.user.userNumber}）`}
        impact="退会させると、この利用者は利用者名簿から削除され、元に戻せません。"
        confirmLabel="退会させる"
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof WithdrawScreen> = {
  title: 'Pages/司書ポータル/退会手続画面',
  component: WithdrawScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '退会手続画面（/staff/users/:userNumber/withdraw）。削除対象の登録内容と進行中取引の件数を提示し、削除可否は API の応答をそのまま表示する（LR-030）。ConfirmActionModal（destructive）を経由してから DELETE を送信する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof WithdrawScreen>

export const Deletable: Story = {
  args: { target: deletableTarget },
  parameters: {
    docs: { story: { description: '削除可能な利用者では退会ボタンが活性になる。' } },
  },
}

export const NotDeletable: Story = {
  args: { target: nonDeletableTarget },
  parameters: {
    docs: { story: { description: '進行中の取引があるときは退会ボタンが非活性になり、件数つきで理由を示す。' } },
  },
}

export const Loading: Story = {
  args: { target: deletableTarget, loading: true },
}

export const ErrorState: Story = {
  args: { target: deletableTarget, error: '対象の利用者が見つかりません' },
}
