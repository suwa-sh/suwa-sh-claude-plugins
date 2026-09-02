import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { DueDateIndicator } from '@/components/domain/DueDateIndicator'
import { LoanStatusBadge } from '@/components/domain/StatusBadges'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import type { LoanState } from '@/components/domain/stateMaps'
import { formatDateLong } from '@/components/common/dateFormat'

/**
 * 貸出内容・返却期限確認画面（/loans/:loanId）。
 * UC 固有コンポーネント LoanDetailPanel / LoanBookSummary を、
 * 共通コンポーネント AsyncSection + Domain の DueDateIndicator / LoanStatusBadge / BookCard の
 * 薄いアダプタとして実装する。
 */

interface LoanDetail {
  loanId: string
  loanDate: string
  loanPeriodType: string
  dueDate: string
  state: LoanState
}

const today = '2026-09-02'

const book: BookSummary = {
  bookId: 'BK-001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '9784101010359',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '貸出中',
}

const safeLoan: LoanDetail = {
  loanId: 'L-000001',
  loanDate: '2026-09-01',
  loanPeriodType: '標準',
  dueDate: '2026-09-16',
  state: '貸出中',
}

const nearLoan: LoanDetail = {
  loanId: 'L-000002',
  loanDate: '2026-08-21',
  loanPeriodType: '標準',
  dueDate: '2026-09-04',
  state: '貸出中',
}

const overdueLoan: LoanDetail = {
  loanId: 'L-000003',
  loanDate: '2026-08-16',
  loanPeriodType: '標準',
  dueDate: '2026-08-30',
  state: '延滞',
}

function LoanDetailScreen({
  mode = 'safe',
}: {
  mode?: 'safe' | 'near' | 'overdue' | 'loading' | 'not-found'
}) {
  const loading = mode === 'loading'
  const notFound = mode === 'not-found'
  const loan = mode === 'near' ? nearLoan : mode === 'overdue' ? overdueLoan : safeLoan

  return (
    <PortalPageLayout
      portal="patron"
      title="貸出内容・返却期限"
      breadcrumb={[{ label: '借りている本', href: '#' }, { label: loan.loanId } ]}
      activeNavId="loans"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={notFound ? '該当する貸出が見つかりません' : null}
        isEmpty={false}
        skeleton="line"
        emptyMessage="貸出情報がありません"
        onRetry={undefined}
        announce
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          <Card>
            <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
                  貸出ID {loan.loanId}
                </span>
                <LoanStatusBadge state={loan.state} dot />
              </div>
              <div className="flex flex-wrap" style={{ gap: 'var(--section-gap)' }}>
                <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
                    貸出日
                  </span>
                  <span style={{ fontFamily: 'var(--font-family-mono)', fontVariantNumeric: 'tabular-nums' }}>
                    {formatDateLong(loan.loanDate)}
                  </span>
                </div>
                <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
                    貸出期間区分
                  </span>
                  <span>{loan.loanPeriodType}</span>
                </div>
                <div className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
                  <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
                    返却期限
                  </span>
                  <DueDateIndicator dueDate={loan.dueDate} today={today} state={loan.state} size="md" />
                </div>
              </div>
            </div>
          </Card>

          <BookCard book={book} />

          {mode === 'overdue' && (
            <div>
              <Button variant="default" iconLeft="corner-down-right">
                返却対象貸出確認画面へ進む
              </Button>
            </div>
          )}
        </div>
      </AsyncSection>
      {notFound && (
        <div style={{ marginTop: 'var(--component-gap)' }}>
          <Button variant="outline" iconLeft="list">
            現在の貸出一覧へ戻る
          </Button>
        </div>
      )}
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/利用者ポータル/貸出内容・返却期限確認画面',
  component: LoanDetailScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '貸出内容・返却期限確認画面。AsyncSection + Card + DueDateIndicator/LoanStatusBadge/BookCard（Domain）の合成。返却期限は色だけでなく残日数の文言でも示す。',
      },
    },
  },
} satisfies Meta<typeof LoanDetailScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Safe: Story = {
  render: () => <LoanDetailScreen mode="safe" />,
}

export const Near: Story = {
  render: () => <LoanDetailScreen mode="near" />,
}

export const Overdue: Story = {
  render: () => <LoanDetailScreen mode="overdue" />,
}

export const Loading: Story = {
  render: () => <LoanDetailScreen mode="loading" />,
}

export const NotFound: Story = {
  render: () => <LoanDetailScreen mode="not-found" />,
}
