import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { HoldPickupCard } from '@/components/domain/HoldPickupCard'
import type { ReservationState } from '@/components/domain/stateMaps'

/**
 * 取置き受取案内画面（/reservations/holds/:reservationId）。取置き案内メールの着地点。
 * HoldPickupPanel（HoldPickupCard + Alert + Button）を、
 * 共通コンポーネント AsyncSection の薄いアダプタとして実装する。
 * 予約状態が「取置き中」でない場合は Alert(info) で現在の状態と次の導線を示す。
 */

interface Hold {
  reservationId: string
  bookTitle: string
  author: string
  holdStartAt: string
  holdDeadline: string
  daysRemaining: number
  userNumber: string
  reservationStatus: ReservationState
}

const holdingToday: Hold = {
  reservationId: 'R-0007',
  bookTitle: '吾輩は猫である',
  author: '夏目漱石',
  holdStartAt: '2026-09-03T10:00:00',
  holdDeadline: '2026-09-09T23:59:00',
  daysRemaining: 3,
  userNumber: 'U-0001',
  reservationStatus: '取置き中',
}

interface ScreenProps {
  hold: Hold | null
  loading?: boolean
  error?: string | null
}

/** hold.daysRemaining と整合する基準日（ISO 日付）を holdDeadline から逆算する */
function baseDateFor(hold: Hold): string {
  const d = new Date(hold.holdDeadline)
  d.setDate(d.getDate() - hold.daysRemaining)
  return d.toISOString().slice(0, 10)
}

function HoldPickupScreen({ hold, loading = false, error = null }: ScreenProps) {
  const isHolding = hold?.reservationStatus === '取置き中'
  const isDeadlineToday = isHolding && hold!.daysRemaining <= 0

  return (
    <PortalPageLayout
      portal="patron"
      title="取置き受取案内"
      description="取置き中の予約の受取情報を確認できます。"
      breadcrumb={[{ label: '予約状況', href: '/reservations' }, { label: '取置き受取案内' }]}
      width="contained"
      activeNavId="reservations"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={!loading && !error && hold === null}
        skeleton="line"
        emptyTitle="対象の予約が見つかりません"
        emptyMessage="予約状況一覧からご確認ください。"
        emptyAction={
          <Button variant="outline" size="sm" iconLeft="list">
            予約状況一覧へ
          </Button>
        }
        onRetry={() => {}}
      >
        {hold && (
          <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            {isDeadlineToday && <Alert tone="warning" title="本日が受取期限" />}
            {!isHolding && (
              <Alert tone="info" title="まだ取置きされていません">
                現在の予約状態は「{hold.reservationStatus}」です。予約順位確認画面からご確認ください。
              </Alert>
            )}
            {isHolding && (
              <HoldPickupCard
                bookTitle={hold.bookTitle}
                author={hold.author}
                holdStartAt={hold.holdStartAt}
                holdDeadline={hold.holdDeadline}
                today={baseDateFor(hold)}
                variant={isDeadlineToday ? 'deadline-today' : 'default'}
                userNumber={hold.userNumber}
                onCancel={() => {}}
              />
            )}
            <div className="flex justify-end" style={{ gap: 'var(--spacing-2)' }}>
              <Button variant="ghost" iconLeft="list">
                予約状況一覧へ
              </Button>
            </div>
          </div>
        )}
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof HoldPickupScreen> = {
  title: 'Pages/利用者ポータル/取置き受取案内画面',
  component: HoldPickupScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '取置き受取案内画面（/reservations/holds/:reservationId）。取置き中の予約 1 件について書籍・取置き期限・残日数・窓口提示用の利用者番号を提示する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof HoldPickupScreen>

export const Default: Story = {
  render: () => <HoldPickupScreen hold={{ ...holdingToday, daysRemaining: 3 }} />,
}

export const DeadlineToday: Story = {
  render: () => (
    <HoldPickupScreen
      hold={{ ...holdingToday, holdDeadline: '2026-09-02T23:59:00', daysRemaining: 0 }}
    />
  ),
}

export const NotHoldingYet: Story = {
  render: () => <HoldPickupScreen hold={{ ...holdingToday, reservationStatus: '予約中' }} />,
}

export const Loading: Story = {
  render: () => <HoldPickupScreen hold={null} loading />,
}

export const NotFound: Story = {
  render: () => <HoldPickupScreen hold={null} />,
}
