import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { useIdempotentMutation } from '@/components/common/hooks/useIdempotentMutation'
import { LoanTable, type Loan } from '@/components/domain/LoanTable'
import { formatDateLong } from '@/components/common/dateFormat'
import { Alert, EmptyState, SkeletonTable } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'

/**
 * 窓口返却受付画面（/staff/returns/new）。
 * 書籍ID / 利用者番号から返却対象の貸出を特定し、確定後に冪等キー付きで返却を登録する。
 * 延滞返却は Alert(warning) と DueDateIndicator(overdue) で超過日数のみを事実として示す。
 * 共通コンポーネント: PortalPageLayout / EntityFormSection / SubmitActionButton。
 */
const TODAY = '2026-09-02'

const findFields: FormFieldSpec[] = [
  { key: 'bookId', label: '書籍ID', kind: 'text', hint: '書籍ラベルのバーコードを読み取るか入力します' },
  { key: 'userNo', label: '利用者番号', kind: 'text', hint: '利用者証のバーコードを読み取るか入力します' },
]

const sampleFound: Loan[] = [
  {
    loanId: 'L-000001',
    bookTitle: '吾輩は猫である',
    bookId: 'B-000001',
    userNumber: 'U-000123',
    userName: '田中太郎',
    loanDate: '2026-08-19',
    dueDate: '2026-09-02',
    loanPeriodType: '標準',
    state: '貸出中',
  },
]

const overdueFound: Loan[] = [
  {
    loanId: 'L-000003',
    bookTitle: '銀河鉄道の夜',
    bookId: 'B-000003',
    userNumber: 'U-000456',
    userName: '鈴木花子',
    loanDate: '2026-08-16',
    dueDate: '2026-08-30',
    loanPeriodType: '標準',
    state: '延滞',
  },
]

interface ScreenProps {
  finding: 'idle' | 'loading' | 'found' | 'empty'
  loans: Loan[]
  submitting?: boolean
  result?: { loanStatus: string; returnedAt: string; overdueDays: number } | null
  error?: { code: string; message: string } | null
}

const ReturnRegistrationScreen: React.FC<ScreenProps> = ({
  finding,
  loans,
  submitting = false,
  result = null,
  error = null,
}) => {
  const [value, setValue] = React.useState<Record<string, string>>({ bookId: '', userNo: '' })
  const [selectedLoanId, setSelectedLoanId] = React.useState<string | null>(loans[0]?.loanId ?? null)
  const { idempotencyKey } = useIdempotentMutation()
  const selected = loans.find((l) => l.loanId === selectedLoanId) ?? null

  return (
    <PortalPageLayout
      portal="staff"
      title="窓口返却受付"
      description="書籍IDまたは利用者番号から返却対象の貸出を特定します。"
      breadcrumb={[{ label: '蔵書利用業務' }, { label: '窓口返却受付' }]}
      width="contained"
      activeNavId="use"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <EntityFormSection
          title="返却対象の特定"
          mode="action"
          fields={findFields}
          value={value}
          onChange={(key, v) => setValue((prev) => ({ ...prev, [key]: v as string }))}
          footer={
            <Button variant="default" iconLeft="search">
              検索する
            </Button>
          }
        />

        {finding === 'loading' && <SkeletonTable rows={3} cols={5} />}

        {finding === 'empty' && (
          <EmptyState icon="search-x" title="該当する貸出が見つかりませんでした" description="書籍IDまたは利用者番号を確認してください" />
        )}

        {finding === 'found' && (
          <div className="flex flex-col" style={{ gap: 'var(--component-gap)' }}>
            <LoanTable
              loans={loans}
              showUser
              today={TODAY}
              onSelect={(l) => setSelectedLoanId(l.loanId)}
            />

            {selected?.state === '延滞' && (
              <Alert tone="warning" title="返却期限を 3 日超過しています">
                延滞督促はこの返却登録により停止します。
              </Alert>
            )}

            {selected && !result && !error && (
              <div className="flex justify-end">
                <SubmitActionButton idempotencyKey={idempotencyKey} onSubmit={() => {}} submitting={submitting}>
                  返却を登録する
                </SubmitActionButton>
              </div>
            )}

            {result && (
              <Alert tone="success" title={`返却済み（返却日 ${formatDateLong(result.returnedAt)}）`}>
                <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
                  {result.overdueDays > 0 && <span>{result.overdueDays} 日超過して返却されました</span>}
                  <a href={`/staff/returns/${selected?.loanId}/restock`} style={{ color: 'var(--primary)' }}>
                    在庫を整える
                  </a>
                </div>
              </Alert>
            )}

            {error && (
              <Alert tone="destructive" title={error.message}>
                <Button variant="outline" size="sm" iconLeft="refresh-cw">
                  返却対象を再特定する
                </Button>
              </Alert>
            )}
          </div>
        )}
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof ReturnRegistrationScreen> = {
  title: 'Pages/司書ポータル/窓口返却受付画面',
  component: ReturnRegistrationScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '窓口返却受付画面（/staff/returns/new）。書籍ID/利用者番号から返却対象を特定し、冪等キー付きで返却を登録する。PortalPageLayout + EntityFormSection + SubmitActionButton の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ReturnRegistrationScreen>

export const Found: Story = {
  args: { finding: 'found', loans: sampleFound },
}

export const FindingLoading: Story = {
  args: { finding: 'loading', loans: [] },
}

export const NotFound: Story = {
  args: { finding: 'empty', loans: [] },
}

export const Overdue: Story = {
  args: { finding: 'found', loans: overdueFound },
  parameters: {
    docs: { description: { story: '延滞は Alert(warning) に超過日数を事実として示す（責める文言は使わない）。' } },
  },
}

export const Submitting: Story = {
  args: { finding: 'found', loans: sampleFound, submitting: true },
  parameters: {
    docs: { description: { story: '登録中は Button が loading かつ disabled、aria-busy が true になる。' } },
  },
}

export const Success: Story = {
  args: {
    finding: 'found',
    loans: sampleFound,
    result: { loanStatus: '返却済み', returnedAt: '2026-09-10', overdueDays: 0 },
  },
}

export const AlreadyReturned: Story = {
  args: {
    finding: 'found',
    loans: sampleFound,
    error: { code: 'LOAN_ALREADY_RETURNED', message: 'この貸出は既に返却済みです' },
  },
}
