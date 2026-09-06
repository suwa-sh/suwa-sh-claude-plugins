import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'

/**
 * 書籍予約申込画面（/books/:bookId/reserve）。
 * UC 固有コンポーネント ReservationApplyPanel を、共通コンポーネント
 * PortalPageLayout + AsyncSection + ConfirmActionModal（confirm）+ SubmitActionButton の
 * 薄いアダプタとして実装する。
 */

const onLoanBook: BookSummary = {
  bookId: 'B-0001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '978-4-10-101035-9',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '貸出中',
}

const availableBook: BookSummary = {
  bookId: 'B-0003',
  title: 'こころ',
  author: '夏目漱石',
  isbn: '978-4-10-101033-5',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '在庫あり',
}

interface ScreenProps {
  book: BookSummary
  expectedRank?: number
  totalReservations?: number
  alreadyReserved?: boolean
  loading?: boolean
  error?: string | null
}

function ReservationApplyScreen({
  book,
  expectedRank = 1,
  totalReservations = 0,
  alreadyReserved = false,
  loading = false,
  error = null,
}: ScreenProps) {
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const isOnLoan = book.state === '貸出中'
  const disabled = !isOnLoan || alreadyReserved || submitting

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
      portal="patron"
      title="書籍予約申込"
      description="貸出中の書籍を予約します。"
      breadcrumb={[{ label: '蔵書をさがす', href: '/search' }, { label: book.title, href: '#' }, { label: '予約申込' }]}
      activeNavId="search"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の書籍が見つかりません"
        onRetry={() => {}}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          {done && (
            <Alert tone="success" title="予約を受け付けました">
              予約順位確認画面で進行状況を確認できます。
            </Alert>
          )}

          <BookCard book={book} reservationCount={totalReservations} />

          {!done && !isOnLoan && (
            <Alert tone="info" title="予約せずにそのまま借りられます">
              この書籍は現在「在庫あり」です。予約は不要です。
            </Alert>
          )}

          {!done && isOnLoan && alreadyReserved && (
            <Alert tone="warning" title="すでに予約済みです">
              この書籍への予約はすでに受け付けています。予約状況一覧から確認してください。
            </Alert>
          )}

          {!done && isOnLoan && !alreadyReserved && (
            <Card>
              <CardHeader title="予約した場合の見込み順位" />
              <ReservationQueueTracker
                state="予約中"
                rank={expectedRank}
                totalReservations={totalReservations}
                bookTitle={book.title}
              />
              <div className="flex items-center justify-end" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--component-gap)' }}>
                <Button variant="outline">戻る</Button>
                <SubmitActionButton
                  idempotencyKey="33333333-3333-4333-8333-333333333333"
                  variant="default"
                  onSubmit={() => setConfirmOpen(true)}
                  submitting={submitting}
                  disabled={disabled}
                >
                  予約する
                </SubmitActionButton>
              </div>
            </Card>
          )}
        </div>
      </AsyncSection>

      <ConfirmActionModal
        open={confirmOpen}
        tone="confirm"
        title="予約を申し込みますか"
        targetLabel={book.title}
        impact="申込後、予約順位確認画面で進行状況を確認できます。"
        confirmLabel="予約する"
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReservationApplyScreen> = {
  title: 'Pages/利用者ポータル/書籍予約申込画面',
  component: ReservationApplyScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '書籍予約申込画面（/books/:bookId/reserve）。貸出中の書籍への予約申込を受け付け、見込み順位と重複予約の有無を申込前に提示する。PortalPageLayout + AsyncSection + ConfirmActionModal（confirm）+ SubmitActionButton の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReservationApplyScreen>

export const OnLoan: Story = {
  args: { book: onLoanBook, expectedRank: 3, totalReservations: 2 },
  parameters: {
    docs: { story: { description: '貸出中の書籍で予約申込を送信できる。見込み順位（自分より前に2人）を提示する。' } },
  },
}

export const AlreadyAvailable: Story = {
  args: { book: availableBook, expectedRank: 1, totalReservations: 0 },
  parameters: {
    docs: { story: { description: '在庫ありの書籍では予約申込を送信できず、Alert(info) で案内する。' } },
  },
}

export const AlreadyReserved: Story = {
  args: { book: onLoanBook, expectedRank: 3, totalReservations: 2, alreadyReserved: true },
  parameters: {
    docs: { story: { description: '重複予約は申込前に検知して Alert(warning) で案内する。' } },
  },
}

export const Loading: Story = {
  args: { book: onLoanBook, loading: true },
}
