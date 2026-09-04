import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import type { ReservationState } from '@/components/domain/stateMaps'

/**
 * 予約順位確認画面（/reservations/:reservationId/rank）。
 * UC 固有コンポーネント ReservationRankPanel を、共通コンポーネント
 * PortalPageLayout + AsyncSection（読み込み中/0件/取得失敗）+ Domain の
 * ReservationQueueTracker / BookCard の薄いアダプタとして実装する。
 */
const TODAY = '2026-09-02'

interface ReservationRankData {
  reservationId: string
  state: ReservationState
  rank: number
  totalReservations: number
  holdDeadline?: string
  book: BookSummary
}

const sampleBook: BookSummary = {
  bookId: 'B-0001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '978-4-10-101035-9',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '予約待ち',
}

const waitingData: ReservationRankData = {
  reservationId: 'R-0007',
  state: '予約中',
  rank: 3,
  totalReservations: 5,
  book: sampleBook,
}

const holdData: ReservationRankData = {
  reservationId: 'R-0100',
  state: '取置き中',
  rank: 1,
  totalReservations: 1,
  holdDeadline: '2026-09-09',
  book: { ...sampleBook, bookId: 'B-0100', title: '銀河鉄道の夜', author: '宮沢賢治', state: '予約待ち' },
}

interface ScreenProps {
  data?: ReservationRankData
  loading?: boolean
  error?: string | null
  notFound?: boolean
}

function ReservationRankScreen({ data, loading = false, error = null, notFound = false }: ScreenProps) {
  return (
    <PortalPageLayout
      portal="patron"
      title="予約順位確認"
      description="予約の進行状況と順位を確認できます。"
      breadcrumb={[{ label: '予約状況', href: '/reservations' }, { label: '予約順位確認' }]}
      activeNavId="reservations"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={notFound}
        skeleton="line"
        emptyTitle="対象の予約が見つかりません"
        emptyMessage="予約が取り消されたか、本人の予約ではない可能性があります。"
        emptyAction={
          <Button variant="outline" iconLeft="bookmark">
            予約状況一覧を見る
          </Button>
        }
        onRetry={() => {}}
      >
        {data && (
          <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            <BookCard book={data.book} reservationCount={data.totalReservations} />
            <Card>
              <CardHeader title="予約の進行状況" />
              <ReservationQueueTracker
                state={data.state}
                rank={data.state === '予約中' ? data.rank : undefined}
                totalReservations={data.totalReservations}
                holdDeadline={data.holdDeadline}
                today={TODAY}
                bookTitle={data.book.title}
              />
              {data.state === '取置き中' && (
                <div style={{ marginTop: 'var(--component-gap)' }}>
                  <Button variant="outline" iconLeft="inbox">
                    取置き受取案内を見る
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReservationRankScreen> = {
  title: 'Pages/利用者ポータル/予約順位確認画面',
  component: ReservationRankScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '予約順位確認画面（/reservations/:reservationId/rank）。予約 1 件の進行段階（予約中→取置き中→貸出済み）と予約順位・待ち人数を提示する。PortalPageLayout + AsyncSection + ReservationQueueTracker（Domain）の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReservationRankScreen>

export const Waiting: Story = {
  args: { data: waitingData },
  parameters: {
    docs: { story: { description: '予約中の予約で順位と待ち人数が表示される。' } },
  },
}

export const OnHold: Story = {
  args: { data: holdData },
  parameters: {
    docs: { story: { description: '取置き中の予約で取置き期限と受取導線が表示される。' } },
  },
}

export const Loading: Story = {
  args: { loading: true },
}

export const NotFound: Story = {
  args: { notFound: true },
}

export const ErrorState: Story = {
  args: { error: '通信エラーが発生しました' },
}
