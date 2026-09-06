import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'
import { DueDateIndicator } from '@/components/domain/DueDateIndicator'
import { LoanConfirmation, type LoanResponse } from '@/components/domain/LoanConfirmation'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

/**
 * 窓口貸出受付画面（/staff/loans/new）。
 * UC 固有コンポーネント LoanRegistrationForm / DueDatePreview を、
 * 共通コンポーネント EntityFormSection（mode="action"）+ SubmitActionButton + Domain の
 * DueDateIndicator / BookCard / UserProfileCard の薄いアダプタとして実装する。
 * 貸出期間区分は選択可能集合に含まれない区分（一般利用者の「長期」）を disabled にする必要があるため、
 * EntityFormSection の外側で ToggleGroup 相当のボタン群をローカル実装する。
 */

interface FormValue {
  bookId: string
  userNo: string
  [key: string]: string
}

const fields: FormFieldSpec[] = [
  { key: 'bookId', label: '書籍ID', kind: 'text', required: true },
  { key: 'userNo', label: '利用者番号', kind: 'text', required: true },
]

const loanPeriodOptions: { value: string; label: string; days: number }[] = [
  { value: '標準', label: '標準（14日）', days: 14 },
  { value: '短期', label: '短期（7日）', days: 7 },
  { value: '長期', label: '長期（30日）', days: 30 },
]

const book: BookSummary = {
  bookId: 'B-000001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '9784101010359',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '在庫あり',
}

const patron: UserProfileCardUser = {
  userNumber: 'U-000123',
  name: '山田花子',
  email: 'yamada@example.jp',
  category: '一般',
  state: '登録済み',
  registeredAt: '2024-04-01',
}

const today = '2026-09-02'

function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function LoanPeriodToggle({
  value,
  onChange,
  disabledValues,
  errorMessage,
}: {
  value: string
  onChange: (v: string) => void
  disabledValues: string[]
  errorMessage?: string
}) {
  return (
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500, color: 'var(--foreground-secondary)' }}>
        貸出期間区分
      </span>
      <div className="flex flex-wrap" style={{ gap: 'var(--spacing-2)' }}>
        {loanPeriodOptions.map((o) => {
          const selected = value === o.value
          const disabled = disabledValues.includes(o.value)
          return (
            <button
              key={o.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-disabled={disabled}
              onClick={() => !disabled && onChange(o.value)}
              className="inline-flex items-center whitespace-nowrap"
              style={{
                height: 'var(--button-height-md)',
                padding: '0 var(--spacing-3)',
                borderRadius: 'var(--radius-full)',
                fontSize: 'var(--font-size-xs)',
                fontWeight: 500,
                background: disabled ? 'var(--background-muted)' : selected ? 'var(--primary)' : 'var(--background)',
                color: disabled
                  ? 'var(--foreground-muted)'
                  : selected
                    ? 'var(--primary-foreground)'
                    : 'var(--foreground-secondary)',
                border: `1px solid ${selected && !disabled ? 'var(--primary)' : 'var(--border)'}`,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.55 : 1,
              }}
            >
              {o.label}
            </button>
          )
        })}
      </div>
      {errorMessage && (
        <span role="alert" style={{ fontSize: 'var(--font-size-xs)', color: 'var(--destructive)' }}>
          {errorMessage}
        </span>
      )}
    </div>
  )
}

function LoanRegistrationScreen({
  mode = 'default',
}: {
  mode?: 'default' | 'submitting' | 'success' | 'conflict' | 'period-mismatch'
}) {
  const [value, setValue] = React.useState<FormValue>({ bookId: book.bookId, userNo: patron.userNumber })
  const [errors] = React.useState<Record<string, string>>({})
  const [loanPeriodType, setLoanPeriodType] = React.useState('標準')
  const [submitting, setSubmitting] = React.useState(mode === 'submitting')
  const [result, setResult] = React.useState<LoanResponse | null>(
    mode === 'success'
      ? {
          loan_id: 'L-000001',
          book_id: book.bookId,
          user_no: patron.userNumber,
          loan_date: today,
          loan_period_type: '標準',
          due_date: '2026-09-16',
          loan_status: '貸出中',
          book_status: '貸出中',
        }
      : null,
  )
  const [conflictMessage] = React.useState<string | null>(
    mode === 'conflict' ? 'この書籍は貸出中のため貸し出せません' : null,
  )

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
  }

  const previewDueDate = addDays(today, loanPeriodOptions.find((o) => o.value === loanPeriodType)?.days ?? 14)

  const onSubmit = () => {
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setResult({
        loan_id: 'L-000001',
        book_id: book.bookId,
        user_no: patron.userNumber,
        loan_date: today,
        loan_period_type: loanPeriodType,
        due_date: previewDueDate,
        loan_status: '貸出中',
        book_status: '貸出中',
      })
    }, 600)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="窓口貸出受付"
      breadcrumb={[{ label: '蔵書利用業務', href: '#' }, { label: '窓口貸出受付' }]}
      activeNavId="use"
      width="contained"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <BookCard book={book} />
        <UserProfileCard user={patron} maskContact />

        <EntityFormSection
          title="貸出登録"
          description="貸出期間区分を選択し、内容を確認のうえ登録してください。"
          mode="action"
          fields={fields}
          value={value}
          onChange={onChange}
          errors={errors}
          formError={conflictMessage}
          footer={
            <SubmitActionButton
              idempotencyKey="33333333-3333-4333-8333-333333333333"
              variant="default"
              onSubmit={onSubmit}
              submitting={submitting}
            >
              貸出を登録する
            </SubmitActionButton>
          }
        />

        <LoanPeriodToggle
          value={loanPeriodType}
          onChange={setLoanPeriodType}
          disabledValues={patron.category === '一般' ? ['長期'] : []}
          errorMessage={
            mode === 'period-mismatch' ? 'この利用者区分では選択できない貸出期間区分です' : undefined
          }
        />

        <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
          <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
            返却期限の見込み
          </span>
          <DueDateIndicator dueDate={previewDueDate} today={today} state="貸出中" size="md" />
        </div>

        <LoanConfirmation result={result} today={today} onLoanSucceeded={() => {}} />

        {conflictMessage && (
          <Alert tone="destructive" title={conflictMessage}>
            <Button variant="outline" size="sm">
              貸出可否判定画面へ戻る
            </Button>
          </Alert>
        )}
      </div>
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/窓口貸出受付画面',
  component: LoanRegistrationScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '窓口貸出受付画面。EntityFormSection（mode="action"）+ SubmitActionButton + DueDateIndicator（登録前の見込み表示） + LoanConfirmation（登録後の確定結果） + BookCard/UserProfileCard（Domain）の合成。選択できない貸出期間区分は disabled にする。',
      },
    },
  },
} satisfies Meta<typeof LoanRegistrationScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <LoanRegistrationScreen mode="default" />,
}

export const Submitting: Story = {
  render: () => <LoanRegistrationScreen mode="submitting" />,
}

export const Success: Story = {
  render: () => <LoanRegistrationScreen mode="success" />,
}

export const Conflict: Story = {
  render: () => <LoanRegistrationScreen mode="conflict" />,
}

export const PeriodMismatch: Story = {
  render: () => <LoanRegistrationScreen mode="period-mismatch" />,
}
