import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PatronLayout } from '@/components/common/PatronLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { AsyncStateView } from '@/components/common/AsyncStateView'
import { BookCard } from '@/components/domain/BookCard'
import { BookStatusBadge } from '@/components/domain/StatusBadges'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { sampleBooks } from '@/components/domain/sampleData'
import type { Book } from '@/components/domain/types'

export interface BookDetailPageProps {
  book: Book | null
  loading?: boolean
  waitingCount?: number
}

/** 書籍詳細・在庫状況画面。状態に応じて窓口案内 / 予約申込 CTA / 電子書籍注記を切り替える。 */
const BookDetailPage: React.FC<BookDetailPageProps> = ({ book, loading = false, waitingCount = 0 }) => {
  const canReserve = book && (book.state === '貸出中' || book.state === '予約待ち') && book.media === '紙'
  return (
    <PatronLayout activeNav="search">
      <PageHeader
        title={book?.title ?? '書籍詳細'}
        status={book ? <BookStatusBadge state={book.state} dot /> : undefined}
        back={{ label: '検索結果へ戻る', onClick: () => {} }}
      />
      <AsyncStateView
        loading={loading}
        error={null}
        empty={!loading && !book}
        skeleton={{ variant: 'card' }}
        emptyState={{ title: 'この書籍は見つかりませんでした', action: { label: '蔵書検索へ戻る', onClick: () => {} } }}
      >
        {book ? (
          <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            <BookCard book={book} variant="detail" />
            {book.state === '在庫あり' ? <Alert tone="info">窓口でお借りいただけます</Alert> : null}
            {book.media === '電子' ? <Alert tone="info">電子書籍は貸出・予約の対象外です</Alert> : null}
            {canReserve ? (
              <div className="flex flex-col" style={{ gap: 'var(--spacing-3)' }}>
                <ReservationQueueTracker state="予約中" position={waitingCount + 1} total={waitingCount} />
                <div>
                  <Button size="lg" icon="bookmark">
                    予約を申し込む
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </AsyncStateView>
    </PatronLayout>
  )
}

const meta: Meta<typeof BookDetailPage> = {
  title: 'Pages/利用者ポータル/書籍詳細・在庫状況画面',
  component: BookDetailPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof BookDetailPage>

export const Available: Story = {
  render: () => <BookDetailPage book={sampleBooks[0]} />,
}

export const OnLoan: Story = {
  render: () => <BookDetailPage book={sampleBooks[1]} waitingCount={2} />,
}

export const Reserved: Story = {
  render: () => <BookDetailPage book={sampleBooks[2]} waitingCount={1} />,
}

export const Loading: Story = {
  render: () => <BookDetailPage book={null} loading />,
}
