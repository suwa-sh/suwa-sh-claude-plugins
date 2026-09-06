import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { userCategories } from '@/components/domain/stateMaps'

/**
 * 利用申込受付画面（/staff/users/new）。
 * UC 固有コンポーネント UserRegisterForm を、共通コンポーネント
 * EntityFormSection（mode="create"）+ SubmitActionButton の薄いアダプタとして実装する。
 * 新規入力が起点で取得待ちが無いため AsyncSection の対象外（common-components.md）。
 */

interface UserRegisterFormValue {
  [key: string]: string
  name: string
  email: string
  userCategory: string
}

const emptyValue: UserRegisterFormValue = { name: '', email: '', userCategory: '一般' }

const fields: FormFieldSpec[] = [
  { key: 'name', label: '氏名', kind: 'text', required: true, hint: '最大100文字' },
  { key: 'email', label: '連絡先（メールアドレス）', kind: 'text', type: 'email', required: true, hint: '個人情報として保護されます' },
  {
    key: 'userCategory',
    label: '利用者区分',
    kind: 'single',
    options: userCategories.map((c) => ({ value: c, label: c })),
    required: true,
  },
]

function UserRegisterScreen({
  initialValue = emptyValue,
  initialErrors = {},
  submitting: initialSubmitting = false,
  registeredUserNo,
}: {
  initialValue?: UserRegisterFormValue
  initialErrors?: Record<string, string>
  submitting?: boolean
  registeredUserNo?: string
}) {
  const [value, setValue] = React.useState<UserRegisterFormValue>(initialValue)
  const [errors, setErrors] = React.useState<Record<string, string>>(initialErrors)
  const [submitting, setSubmitting] = React.useState(initialSubmitting)
  const [userNo, setUserNo] = React.useState<string | null>(registeredUserNo ?? null)

  const disabled = !value.name || !value.email || !value.userCategory || submitting

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }

  const onSubmit = () => {
    const nextErrors: Record<string, string> = {}
    if (!value.name) nextErrors.name = '氏名を入力してください'
    if (!value.email) nextErrors.email = '連絡先を入力してください'
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setUserNo('U-000789')
    }, 800)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="利用申込受付"
      description="新規利用者の申込を受け付けます。"
      breadcrumb={[{ label: '利用者名簿', href: '/staff/users' }, { label: '利用申込受付' }]}
      activeNavId="user"
      width="contained"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        {userNo && (
          <Alert tone="success" title={`利用者番号「${userNo}」で登録しました`} actions={<Button variant="outline" size="sm">利用者名簿へ戻る</Button>}>
            「{value.name}」を利用者として登録しました。
          </Alert>
        )}
        <EntityFormSection
          title="利用申込情報"
          description="氏名・連絡先を入力し、利用者区分を選択してください。"
          mode="create"
          fields={fields}
          value={value}
          onChange={onChange}
          errors={errors}
          formError={null}
          footer={
            <>
              <Button variant="outline">利用者名簿へ戻る</Button>
              <SubmitActionButton
                idempotencyKey="55555555-5555-4555-8555-555555555555"
                variant="default"
                onSubmit={onSubmit}
                submitting={submitting}
                disabled={disabled}
              >
                登録する
              </SubmitActionButton>
            </>
          }
        />
      </div>
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/司書ポータル/利用申込受付画面',
  component: UserRegisterScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '利用申込受付画面（/staff/users/new）。氏名・連絡先・利用者区分の入力フォーム、送信中の二重送信防止、採番結果の提示を実装する。EntityFormSection（mode="create"）+ SubmitActionButton の合成。',
      },
    },
  },
} satisfies Meta<typeof UserRegisterScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <UserRegisterScreen />,
}

export const ValidationErrors: Story = {
  render: () => (
    <UserRegisterScreen initialErrors={{ name: '氏名を入力してください', email: '連絡先を入力してください' }} />
  ),
}

export const Submitting: Story = {
  render: () => (
    <UserRegisterScreen initialValue={{ name: '田中太郎', email: 'tanaka@example.com', userCategory: '一般' }} submitting />
  ),
}

export const Registered: Story = {
  render: () => (
    <UserRegisterScreen
      initialValue={{ name: '田中太郎', email: 'tanaka@example.com', userCategory: '一般' }}
      registeredUserNo="U-000123"
    />
  ),
}
