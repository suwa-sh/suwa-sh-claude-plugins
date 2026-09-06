import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'

/**
 * 除籍手続画面（/staff/books/:bookId/withdraw）。
 * UC 固有コンポーネント BookWithdrawalPanel / WithdrawalConfirmModal を、
 * 共通コンポーネント AsyncSection（可否判定取得）+ ConfirmActionModal（destructive）+
 * SubmitActionButton の薄いアダプタとして実装する。
 */

const targetBook: BookSummary = {
  bookId: 'BK-000123',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '978-4-10-101035-9',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '在庫あり',
}

function BookWithdrawalScreen({
  loading = false,
  deletable = true,
  reasons = [],
}: {
  loading?: boolean
  deletable?: boolean
  reasons?: string[]
}) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const onConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setOpen(false)
      setDone(true)
    }, 800)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="除籍手続"
      breadcrumb={[{ label: '蔵書管理台帳', href: '#' }, { label: '除籍手続' }]}
      activeNavId="collection"
      width="contained"
      actions={
        <Button variant="outline" iconLeft="arrow-left">
          台帳へ戻る
        </Button>
      }
    >
      {done && (
        <Alert tone="success" title="除籍しました">
          「{targetBook.title}」を除籍しました。
        </Alert>
      )}
      <AsyncSection
        loading={loading}
        error={null}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の書籍が見つかりません"
        announce
      >
        <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
          <BookCard book={targetBook} reservationCount={reasons.length > 0 ? 1 : 0} />
          {!deletable && reasons.length > 0 && (
            <Alert tone="warning" title="この書籍は除籍できません">
              <ul style={{ margin: 0, paddingLeft: 'var(--spacing-4)' }}>
                {reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </Alert>
          )}
          <div className="flex justify-end" style={{ gap: 'var(--spacing-2)' }}>
            <Button variant="outline">取消</Button>
            <SubmitActionButton
              idempotencyKey="33333333-3333-4333-8333-333333333333"
              variant="destructive"
              onSubmit={() => setOpen(true)}
              disabled={!deletable || done}
            >
              除籍する
            </SubmitActionButton>
          </div>
        </div>
      </AsyncSection>
      <ConfirmActionModal
        open={open}
        tone="destructive"
        title="除籍の確認"
        targetLabel={targetBook.title}
        impact="この操作は取り消せません。蔵書一覧から除外されます。"
        confirmLabel="除籍する"
        onConfirm={onConfirm}
        onCancel={() => setOpen(false)}
        submitting={submitting}
      />
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/除籍手続画面',
  component: BookWithdrawalScreen,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BookWithdrawalScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Deletable: Story = {
  render: () => <BookWithdrawalScreen deletable reasons={[]} />,
}

export const NotDeletable: Story = {
  render: () => (
    <BookWithdrawalScreen
      deletable={false}
      reasons={['貸出中のため除籍できません', '取置き中の予約が1件あります']}
    />
  ),
}

export const Loading: Story = {
  render: () => <BookWithdrawalScreen loading />,
}
