import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { HoldPickupCard } from '@/components/domain/HoldPickupCard'
import { Alert } from '@/components/ui/Feedback'

/**
 * 取置き中予約確認画面（/reservations/holds）。
 * 本人の取置き中の予約を受取期限つきカード（HoldPickupCard）で一覧表示する。
 * 期限当日の取置きは上部の Alert(warning) で件数を強調する。
 * 共通コンポーネント: PortalPageLayout / AsyncSection（ページ送りを伴わないため DataListSection は使わない）。
 */
interface HoldItem {
  reservationId: string
  bookTitle: string
  bookAuthor: string
  holdStartedAt: string
  holdExpiresAt: string
  daysRemaining: number
}

const sampleHolds: HoldItem[] = [
  {
    reservationId: 'R-0007',
    bookTitle: '銀河鉄道の夜',
    bookAuthor: '宮沢賢治',
    holdStartedAt: '2026-08-30T10:00:00+09:00',
    holdExpiresAt: '2026-09-05T23:59:00+09:00',
    daysRemaining: 3,
  },
  {
    reservationId: 'R-0008',
    bookTitle: '坊っちゃん',
    bookAuthor: '夏目漱石',
    holdStartedAt: '2026-08-27T09:30:00+09:00',
    holdExpiresAt: '2026-09-02T23:59:00+09:00',
    daysRemaining: 0,
  },
]

const USER_NUMBER = 'U-000123'

/** item.daysRemaining と整合する基準日（ISO 日付）を holdExpiresAt から逆算する */
function baseDateFor(item: HoldItem): string {
  const d = new Date(item.holdExpiresAt)
  d.setDate(d.getDate() - item.daysRemaining)
  return d.toISOString().slice(0, 10)
}

interface ScreenProps {
  items: HoldItem[]
  loading?: boolean
  error?: string | null
}

const HoldsScreen: React.FC<ScreenProps> = ({ items, loading = false, error = null }) => {
  const expiringTodayCount = items.filter((i) => i.daysRemaining <= 0).length

  return (
    <PortalPageLayout
      portal="patron"
      title="取置き中の予約"
      description="受取期限までに窓口で受け取ってください。"
      breadcrumb={[{ label: '予約状況', href: '/reservations' }, { label: '取置き中' }]}
      width="contained"
      activeNavId="reservations"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        {!loading && !error && expiringTodayCount > 0 && (
          <Alert tone="warning" title={`本日が受取期限の取置きが ${expiringTodayCount} 件あります`} />
        )}
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && items.length === 0}
          skeleton="line"
          emptyMessage="取置き中の予約はありません"
          emptyAction={
            <a href="/reservations" style={{ color: 'var(--primary)' }}>
              予約状況一覧を見る
            </a>
          }
          onRetry={() => {}}
          readyCount={items.length}
        >
          <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
            {items.map((item) => (
              <HoldPickupCard
                key={item.reservationId}
                bookTitle={item.bookTitle}
                author={item.bookAuthor}
                holdStartAt={item.holdStartedAt}
                holdDeadline={item.holdExpiresAt}
                today={baseDateFor(item)}
                variant={item.daysRemaining <= 0 ? 'deadline-today' : 'default'}
                userNumber={USER_NUMBER}
              />
            ))}
          </div>
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof HoldsScreen> = {
  title: 'Pages/利用者ポータル/取置き中予約確認画面',
  component: HoldsScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '取置き中予約確認画面（/reservations/holds）。取置き中の予約を HoldPickupCard で一覧表示し、期限当日は Alert(warning) で強調する。PortalPageLayout + AsyncSection の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof HoldsScreen>

export const Default: Story = {
  args: { items: sampleHolds },
}

export const Loading: Story = {
  args: { items: [], loading: true },
}

export const Empty: Story = {
  args: { items: [] },
}

export const DeadlineToday: Story = {
  args: { items: [sampleHolds[1]] },
  parameters: {
    docs: {
      description: { story: '期限当日は Alert(warning) に件数が表示され、該当カードで残日数「本日が受取期限」を文言で示す。' },
    },
  },
}

export const ErrorState: Story = {
  args: { items: [], error: '取置き情報を取得できませんでした' },
}
