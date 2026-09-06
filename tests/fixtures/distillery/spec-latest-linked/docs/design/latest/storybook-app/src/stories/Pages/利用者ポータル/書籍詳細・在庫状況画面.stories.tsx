import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import type { BookState } from '@/components/domain/stateMaps'

/**
 * 書籍詳細・在庫状況画面（/books/:bookId）。
 * UC 固有コンポーネント BookAvailabilityPanel / ReservationAvailabilityAction を、
 * 共通コンポーネント AsyncSection + Domain の BookCard / ReservationQueueTracker の
 * 薄いアダプタとして実装する。
 */

interface AvailabilityData {
  book: BookSummary
  reservationCount: number
  guidance: string
  reservable: boolean
}

const availableBook: AvailabilityData = {
  book: {
    bookId: 'BK-001',
    title: '吾輩は猫である',
    author: '夏目漱石',
    isbn: '9784101010359',
    publisher: '新潮社',
    genre: '文学',
    materialType: '紙書籍',
    state: '在庫あり',
  },
  reservationCount: 0,
  guidance: '予約せずにそのまま借りられます。',
  reservable: false,
}

const onLoanBook: AvailabilityData = {
  book: {
    bookId: 'BK-002',
    title: '銀河鉄道の夜',
    author: '宮沢賢治',
    isbn: '9784003110537',
    publisher: '岩波書店',
    genre: '文学',
    materialType: '紙書籍',
    state: '貸出中',
  },
  reservationCount: 2,
  guidance: '貸出中です。予約すると返却後に取置きされます。',
  reservable: true,
}

function BookAvailabilityScreen({
  mode = 'available',
}: {
  mode?: 'available' | 'on-loan' | 'loading' | 'not-found'
}) {
  const [reserved, setReserved] = React.useState(false)
  const loading = mode === 'loading'
  const notFound = mode === 'not-found'
  const data = mode === 'on-loan' ? onLoanBook : availableBook
  const state: BookState = data.book.state

  return (
    <PortalPageLayout
      portal="patron"
      title="書籍詳細・在庫状況"
      breadcrumb={[{ label: '蔵書をさがす', href: '#' }, { label: data.book.title }]}
      activeNavId="search"
      width="contained"
      actions={
        <Button variant="ghost" iconLeft="arrow-left">
          検索へ戻る
        </Button>
      }
    >
      <AsyncSection
        loading={loading}
        error={notFound ? '対象の書籍が見つかりません' : null}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の書籍がありません"
        onRetry={notFound ? undefined : () => undefined}
        announce
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          <BookCard book={data.book} reservationCount={data.reservationCount} />

          <Alert tone={state === '在庫あり' ? 'success' : 'info'} title={data.guidance} />

          {data.reservable && (
            <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
              <ReservationQueueTracker
                state="予約中"
                totalReservations={data.reservationCount}
                bookTitle={data.book.title}
              />
              <div>
                <Button
                  variant="default"
                  size="lg"
                  iconLeft="bookmark"
                  onClick={() => setReserved(true)}
                >
                  この本を予約する
                </Button>
              </div>
              {reserved && (
                <Alert tone="success" title="予約申込画面へ遷移します">
                  「{data.book.title}」の予約申込を続けます。
                </Alert>
              )}
            </div>
          )}
        </div>
      </AsyncSection>
      {notFound && (
        <div style={{ marginTop: 'var(--component-gap)' }}>
          <Button variant="outline" iconLeft="search">
            蔵書検索画面へ戻る
          </Button>
        </div>
      )}
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/利用者ポータル/書籍詳細・在庫状況画面',
  component: BookAvailabilityScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '書籍詳細・在庫状況画面。AsyncSection + BookCard（Domain）+ ReservationQueueTracker（Domain）の合成。在庫ありは予約ボタンを出さず肯定形の案内を表示する。',
      },
    },
  },
} satisfies Meta<typeof BookAvailabilityScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Available: Story = {
  render: () => <BookAvailabilityScreen mode="available" />,
}

export const OnLoanWithReservation: Story = {
  render: () => <BookAvailabilityScreen mode="on-loan" />,
}

export const Loading: Story = {
  render: () => <BookAvailabilityScreen mode="loading" />,
}

export const NotFound: Story = {
  render: () => <BookAvailabilityScreen mode="not-found" />,
}
