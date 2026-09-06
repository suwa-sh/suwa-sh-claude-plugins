import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { BookCard, type BookSummary } from '@/components/domain/BookCard'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

/**
 * 貸出可否判定画面（/staff/loans/eligibility）。
 * UC 固有コンポーネント LoanEligibilityForm / LoanEligibilityResult を、
 * 共通コンポーネント EntityFormSection（mode="action"）+ SubmitActionButton + AsyncSection の
 * 薄いアダプタとして実装する。判定結果（可否 + 根拠条件）は Alert に並置表示する。
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

const eligibleBook: BookSummary = {
  bookId: 'B-000001',
  title: '吾輩は猫である',
  author: '夏目漱石',
  isbn: '9784101010359',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '在庫あり',
}

const ineligibleBook: BookSummary = {
  bookId: 'B-000003',
  title: 'こころ',
  author: '夏目漱石',
  isbn: '9784101010328',
  publisher: '新潮社',
  genre: '文学',
  materialType: '紙書籍',
  state: '貸出中',
}

const patron: UserProfileCardUser = {
  userNumber: 'U-000123',
  name: '山田花子',
  email: 'yamada@example.jp',
  category: '一般',
  state: '登録済み',
  registeredAt: '2024-04-01',
}

type Result = { eligible: boolean; reasons: { conditionName: string; detail: string }[] } | null

function LoanEligibilityScreen({
  mode = 'idle',
}: {
  mode?: 'idle' | 'eligible' | 'ineligible' | 'validation-error' | 'submitting'
}) {
  const [value, setValue] = React.useState<FormValue>({
    bookId: mode === 'validation-error' ? '' : eligibleBook.bookId,
    userNo: patron.userNumber,
  })
  const [errors, setErrors] = React.useState<Record<string, string>>(
    mode === 'validation-error' ? { bookId: '書籍IDを入力してください' } : {},
  )
  const [submitting, setSubmitting] = React.useState(mode === 'submitting')
  const [result, setResult] = React.useState<Result>(
    mode === 'eligible'
      ? { eligible: true, reasons: [{ conditionName: '貸出可否条件', detail: '在庫あり・未登録利用者ではない' }] }
      : mode === 'ineligible'
        ? {
            eligible: false,
            reasons: [{ conditionName: '貸出可否条件', detail: '書籍状態が貸出中のため貸し出せません' }],
          }
        : null,
  )

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!value.bookId) nextErrors.bookId = '書籍IDを入力してください'
    if (!value.userNo) nextErrors.userNo = '利用者番号を入力してください'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setSubmitting(true)
    window.setTimeout(() => {
      setSubmitting(false)
      setResult({ eligible: true, reasons: [{ conditionName: '貸出可否条件', detail: '在庫あり・未登録利用者ではない' }] })
    }, 600)
  }

  const book = mode === 'ineligible' ? ineligibleBook : eligibleBook

  return (
    <PortalPageLayout
      portal="staff"
      title="貸出可否判定"
      breadcrumb={[{ label: '蔵書利用業務', href: '#' }, { label: '貸出可否判定' }]}
      activeNavId="use"
      width="contained"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <EntityFormSection
          title="判定対象"
          description="書籍IDと利用者番号を入力して貸出可否を判定します。"
          mode="action"
          fields={fields}
          value={value}
          onChange={onChange}
          errors={errors}
          formError={null}
          footer={
            <SubmitActionButton
              idempotencyKey="22222222-2222-4222-8222-222222222222"
              variant="default"
              onSubmit={onSubmit}
              submitting={submitting}
            >
              判定する
            </SubmitActionButton>
          }
        />

        <AsyncSection
          loading={submitting}
          error={null}
          isEmpty={result === null}
          skeleton="line"
          emptyMessage="判定を実行すると結果がここに表示されます。"
          announce
        >
          {result && (
            <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
              <Alert tone={result.eligible ? 'success' : 'destructive'} title={result.eligible ? '貸出可' : '貸出不可'}>
                {result.reasons.map((r) => (
                  <div key={r.conditionName}>
                    {r.conditionName}: {r.detail}
                  </div>
                ))}
              </Alert>
              <BookCard book={book} />
              <UserProfileCard user={patron} maskContact />
              {result.eligible && (
                <div>
                  <Button variant="default" size="lg" iconRight="arrow-right">
                    窓口貸出受付画面へ進む
                  </Button>
                </div>
              )}
            </div>
          )}
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/貸出可否判定画面',
  component: LoanEligibilityScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '貸出可否判定画面。EntityFormSection（mode="action"）+ SubmitActionButton + AsyncSection + BookCard/UserProfileCard（Domain）の合成。判定不可時は根拠条件・不足項目を Alert(destructive) に展開する。',
      },
    },
  },
} satisfies Meta<typeof LoanEligibilityScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Idle: Story = {
  render: () => <LoanEligibilityScreen mode="idle" />,
}

export const Eligible: Story = {
  render: () => <LoanEligibilityScreen mode="eligible" />,
}

export const Ineligible: Story = {
  render: () => <LoanEligibilityScreen mode="ineligible" />,
}

export const ValidationError: Story = {
  render: () => <LoanEligibilityScreen mode="validation-error" />,
}

export const Submitting: Story = {
  render: () => <LoanEligibilityScreen mode="submitting" />,
}
