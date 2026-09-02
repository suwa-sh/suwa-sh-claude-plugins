import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { ReservationStatusBadge } from '@/components/domain/StatusBadges'
import type { ReservationState } from '@/components/domain/stateMaps'

/**
 * 予約取消受付画面（/reservations/:reservationId/cancel）。司書ポータルで提供する
 * （design-event.yaml の route 上は portal=patron の割当てだが、RDRA 上のアクターが司書のため
 * 司書ポータルのナビゲーション空間で仕様化する。既知のねじれ）。
 * UC 固有コンポーネント ReservationCancelPanel / CancelResultSummary を、共通コンポーネント
 * PortalPageLayout + AsyncSection + ConfirmActionModal + SubmitActionButton の薄いアダプタとして実装する。
 */

interface CancelTargetReservation {
  reservationId: string
  bookTitle: string
  userNo: string
  priority: number
  state: ReservationState
  holdExpiresAt?: string
}

const cancellableReservation: CancelTargetReservation = {
  reservationId: 'R-0007',
  bookTitle: '吾輩は猫である',
  userNo: 'U-000123',
  priority: 1,
  state: '予約中',
}

const nonCancellableReservation: CancelTargetReservation = {
  reservationId: 'R-0200',
  bookTitle: '坊っちゃん',
  userNo: 'U-000456',
  priority: 1,
  state: '貸出済み',
}

interface ScreenProps {
  reservation: CancelTargetReservation
  loading?: boolean
  error?: string | null
}

function ReservationCancelScreen({ reservation, loading = false, error = null }: ScreenProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [result, setResult] = React.useState<{ promotedCount: number; bookStatus: string } | null>(null)

  const cancellable = reservation.state === '予約中' || reservation.state === '取置き中'

  const onConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setConfirmOpen(false)
      setResult({ promotedCount: 1, bookStatus: '予約待ち' })
    }, 600)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="予約取消受付"
      description="窓口で申し出のあった予約を取り消します。"
      breadcrumb={[{ label: '予約・取置き', href: '/staff/reservations' }, { label: '予約取消受付' }]}
      activeNavId="reservation"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の予約が見つかりません"
        onRetry={() => {}}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          {result && (
            <Alert tone="success" title="予約を取り消しました">
              予約状態が「キャンセル」になりました。繰り上げ {result.promotedCount} 件・書籍状態は「{result.bookStatus}」です。
            </Alert>
          )}
          <Card>
            <CardHeader
              title={reservation.bookTitle}
              description={`利用者番号: ${reservation.userNo} / 予約順位: ${reservation.priority}`}
              actions={<ReservationStatusBadge state={reservation.state} dot />}
            />
            {!cancellable && !result && (
              <Alert tone="warning" title="すでに貸出済みのため取り消せません">
                対象予約の状態は「{reservation.state}」です。取消できるのは「予約中」「取置き中」のみです。
              </Alert>
            )}
            {cancellable && !result && (
              <div className="flex items-center justify-end" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--component-gap)' }}>
                <Button variant="outline">中止</Button>
                <SubmitActionButton
                  idempotencyKey="22222222-2222-4222-8222-222222222222"
                  variant="destructive"
                  onSubmit={() => setConfirmOpen(true)}
                  submitting={submitting}
                  disabled={!cancellable}
                >
                  取消を実行
                </SubmitActionButton>
              </div>
            )}
          </Card>
        </div>
      </AsyncSection>

      <ConfirmActionModal
        open={confirmOpen}
        tone="destructive"
        title="予約を取り消しますか"
        targetLabel={`${reservation.bookTitle}（利用者: ${reservation.userNo} / 順位 ${reservation.priority}）`}
        impact="この予約はキャンセルとなり、後続の予約者が繰り上がります。取り消し後は元に戻せません。"
        confirmLabel="取り消す"
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReservationCancelScreen> = {
  title: 'Pages/司書ポータル/予約取消受付画面',
  component: ReservationCancelScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '予約取消受付画面（/reservations/:reservationId/cancel）。司書が窓口で予約取消を受け付ける。ConfirmActionModal（destructive）による意図的な壁を経由し、取消後は繰り上げ件数と書籍状態を完了サマリとして提示する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReservationCancelScreen>

export const Cancellable: Story = {
  args: { reservation: cancellableReservation },
  parameters: {
    docs: { story: { description: '予約中の予約は取消ボタンが活性になり、確認モーダル経由で取り消せる。' } },
  },
}

export const NotCancellable: Story = {
  args: { reservation: nonCancellableReservation },
  parameters: {
    docs: { story: { description: '貸出済みの予約は取消ボタンが非活性になり、根拠の Alert(warning) が表示される。' } },
  },
}

export const Loading: Story = {
  args: { reservation: cancellableReservation, loading: true },
}

export const ErrorState: Story = {
  args: { reservation: cancellableReservation, error: '通信エラーが発生しました' },
}
