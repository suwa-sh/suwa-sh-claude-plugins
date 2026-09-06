import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { useIdempotentMutation } from '@/components/common/hooks/useIdempotentMutation'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import { BookStatusBadge, ReservationStatusBadge } from '@/components/domain/StatusBadges'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

/**
 * 返却後在庫整理画面（/staff/returns/:loanId/restock）。
 * 返却受付直後の書籍について、有効な予約の有無に応じた遷移先（在庫あり / 予約待ち）を
 * 冪等キー付きで確定する。予約待ちになった場合は取置き対象者特定画面への導線を出す。
 * 共通コンポーネント: PortalPageLayout / AsyncSection / SubmitActionButton。
 */
interface NextReservation {
  reservationId: string
  priority: number
  userNo: string
}

interface ScreenProps {
  book: BookSummary
  activeReservationCount: number
  loading?: boolean
  submitting?: boolean
  result?: { bookStatus: '在庫あり' | '予約待ち'; nextReservation: NextReservation | null } | null
  error?: { code: string; message: string } | null
}

const sampleBook: BookSummary = {
  bookId: 'B-000001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '978-4-10-101012-3',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '貸出中',
}

const RestockScreen: React.FC<ScreenProps> = ({
  book,
  activeReservationCount,
  loading = false,
  submitting = false,
  result = null,
  error = null,
}) => {
  const { idempotencyKey } = useIdempotentMutation()

  return (
    <PortalPageLayout
      portal="staff"
      title="返却後在庫整理"
      description="返却された書籍の状態を確定します。"
      breadcrumb={[{ label: '蔵書利用業務' }, { label: '返却後在庫整理' }]}
      width="contained"
      activeNavId="use"
    >
      <AsyncSection
        loading={loading}
        error={null}
        isEmpty={false}
        skeleton="line"
        emptyMessage=""
        onRetry={() => {}}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          <BookCard book={book} reservationCount={activeReservationCount} />

          {!result && !error && (
            <>
              {activeReservationCount > 0 ? (
                <Alert tone="warning" title="予約順1位の利用者のために取り置きます" />
              ) : (
                <Alert tone="info" title="在庫ありへ戻します" />
              )}
              <div className="flex justify-end">
                <SubmitActionButton idempotencyKey={idempotencyKey} onSubmit={() => {}} submitting={submitting}>
                  在庫を整える
                </SubmitActionButton>
              </div>
            </>
          )}

          {result && result.bookStatus === '在庫あり' && (
            <Alert tone="success" title="書籍状態を更新しました">
              <div className="flex items-center" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                <BookStatusBadge state="在庫あり" dot />
                <a href="/staff/returns/new" style={{ color: 'var(--primary)' }}>
                  次の返却受付へ進む
                </a>
              </div>
            </Alert>
          )}

          {result && result.bookStatus === '予約待ち' && result.nextReservation && (
            <Alert tone="success" title="書籍状態を更新しました">
              <div className="flex flex-col" style={{ gap: 'var(--spacing-2)', marginTop: 'var(--spacing-2)' }}>
                <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
                  <BookStatusBadge state="予約待ち" dot />
                  <ReservationStatusBadge state="予約中" dot />
                  <span>利用者番号 {result.nextReservation.userNo}</span>
                </div>
                <Button variant="outline" iconLeft="arrow-right">
                  取置き対象者を特定する
                </Button>
              </div>
            </Alert>
          )}

          {error && (
            <Alert tone="destructive" title={error.message}>
              <a href="/staff/books" style={{ color: 'var(--primary)' }}>
                蔵書管理台帳を開く
              </a>
            </Alert>
          )}
        </div>
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof RestockScreen> = {
  title: 'Pages/司書ポータル/返却後在庫整理画面',
  component: RestockScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '返却後在庫整理画面（/staff/returns/:loanId/restock）。有効な予約の有無に応じた遷移先を冪等キー付きで確定する。PortalPageLayout + AsyncSection + SubmitActionButton の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof RestockScreen>

export const NoReservation: Story = {
  args: { book: sampleBook, activeReservationCount: 0 },
}

export const WithReservation: Story = {
  args: { book: sampleBook, activeReservationCount: 2 },
  parameters: {
    docs: { description: { story: '有効な予約があると Alert(warning) で予約順1位への取置きを事前案内する。' } },
  },
}

export const Submitting: Story = {
  args: { book: sampleBook, activeReservationCount: 0, submitting: true },
}

export const ResultInStock: Story = {
  args: {
    book: { ...sampleBook, state: '在庫あり' },
    activeReservationCount: 0,
    result: { bookStatus: '在庫あり', nextReservation: null },
  },
}

export const ResultReserved: Story = {
  args: {
    book: { ...sampleBook, state: '予約待ち' },
    activeReservationCount: 2,
    result: {
      bookStatus: '予約待ち',
      nextReservation: { reservationId: 'R-000001', priority: 1, userNo: 'U-000123' },
    },
  },
}

export const NotOnLoanError: Story = {
  args: {
    book: sampleBook,
    activeReservationCount: 0,
    error: { code: 'BOOK_NOT_ON_LOAN', message: 'この書籍は貸出中ではないため在庫整理できません' },
  },
}
