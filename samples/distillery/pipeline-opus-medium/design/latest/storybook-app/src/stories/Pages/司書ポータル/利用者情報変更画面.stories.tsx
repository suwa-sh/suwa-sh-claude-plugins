import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { EntityFormSection, type FormFieldSpec } from '@/components/common/EntityFormSection'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'
import { Button } from '@/components/ui/Button'
import { Alert } from '@/components/ui/Feedback'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'
import { userCategories } from '@/components/domain/stateMaps'

/**
 * 利用者情報変更画面（/staff/users/:userNumber/edit）。
 * UC 固有コンポーネント UserEditForm を、共通コンポーネント
 * PortalPageLayout + AsyncSection + EntityFormSection（mode="edit"）+ ConfirmActionModal（confirm）+
 * SubmitActionButton の薄いアダプタとして実装する。
 */

interface EditFormValue {
  [key: string]: string
  name: string
  email: string
  userCategory: string
}

const currentUser: UserProfileCardUser = {
  userNumber: 'U-000123',
  name: '田中太郎',
  email: 'tanaka@example.com',
  category: '一般',
  state: '登録済み',
  registeredAt: '2025-04-01',
}

const currentValue: EditFormValue = {
  name: currentUser.name,
  email: currentUser.email,
  userCategory: currentUser.category,
}

const fields: FormFieldSpec[] = [
  { key: 'name', label: '氏名', kind: 'text', required: true, hint: '最大100文字' },
  { key: 'email', label: '連絡先（メールアドレス）', kind: 'text', type: 'email', required: true },
  {
    key: 'userCategory',
    label: '利用者区分',
    kind: 'single',
    options: userCategories.map((c) => ({ value: c, label: c })),
    required: true,
  },
]

interface ScreenProps {
  user?: UserProfileCardUser
  loading?: boolean
  error?: string | null
  conflictOnSave?: boolean
}

function UserEditScreen({ user = currentUser, loading = false, error = null, conflictOnSave = false }: ScreenProps) {
  const current: EditFormValue = { name: user.name, email: user.email, userCategory: user.category }
  const [value, setValue] = React.useState<EditFormValue>(current)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [conflict, setConflict] = React.useState(false)
  const [done, setDone] = React.useState(false)

  const dirtyFields = (Object.keys(current) as (keyof EditFormValue)[]).filter((k) => current[k] !== value[k])
  const disabled = !value.name || !value.email || dirtyFields.length === 0 || submitting

  const onChange = (key: string, next: string | string[]) => {
    setValue((v) => ({ ...v, [key]: Array.isArray(next) ? next[0] ?? '' : next }))
    setErrors((e) => {
      const { [key]: _removed, ...rest } = e
      return rest
    })
  }

  const onConfirm = () => {
    setSubmitting(true)
    setTimeout(() => {
      setSubmitting(false)
      setConfirmOpen(false)
      if (conflictOnSave) {
        setConflict(true)
      } else {
        setDone(true)
      }
    }, 600)
  }

  return (
    <PortalPageLayout
      portal="staff"
      title="利用者情報変更"
      description="登録内容を編集します。"
      breadcrumb={[{ label: '利用者名簿', href: '/staff/users' }, { label: '利用者情報変更' }]}
      activeNavId="user"
      width="contained"
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={false}
        skeleton="line"
        emptyMessage="対象の利用者が見つかりません"
        onRetry={() => {}}
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          {done && <Alert tone="success" title="変更を保存しました" />}
          {conflict && (
            <Alert
              tone="warning"
              title="他の司書が更新しました"
              actions={
                <Button variant="outline" size="sm" iconLeft="refresh-cw">
                  最新を再取得する
                </Button>
              }
            >
              最新を取得してから保存してください。
            </Alert>
          )}

          <UserProfileCard user={user} maskContact />

          <EntityFormSection
            title="編集フォーム"
            description="変更した項目だけが保存前の確認画面に表示されます。"
            mode="edit"
            fields={fields}
            value={value}
            onChange={onChange}
            current={current}
            errors={errors}
            formError={null}
            footer={
              <>
                <Button variant="outline">キャンセル</Button>
                <SubmitActionButton
                  idempotencyKey="66666666-6666-4666-8666-666666666666"
                  variant="default"
                  onSubmit={() => setConfirmOpen(true)}
                  submitting={submitting}
                  disabled={disabled}
                >
                  保存する
                </SubmitActionButton>
              </>
            }
          />
        </div>
      </AsyncSection>

      <ConfirmActionModal
        open={confirmOpen}
        tone="confirm"
        title="変更を保存しますか"
        targetLabel={`${user.name}（${user.userNumber}） / 変更項目: ${fields
          .filter((f) => dirtyFields.includes(f.key as keyof EditFormValue))
          .map((f) => f.label)
          .join('、')}`}
        impact="保存すると変更内容が反映されます。"
        confirmLabel="保存する"
        onConfirm={onConfirm}
        onCancel={() => setConfirmOpen(false)}
        submitting={submitting}
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof UserEditScreen> = {
  title: 'Pages/司書ポータル/利用者情報変更画面',
  component: UserEditScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '利用者情報変更画面（/staff/users/:userNumber/edit）。現在値を UserProfileCard で提示し、変更差分だけを ConfirmActionModal（confirm）で確認してから保存する。EntityFormSection（mode="edit"）+ SubmitActionButton の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof UserEditScreen>

export const Default: Story = {
  args: { user: currentUser },
}

export const Loading: Story = {
  args: { user: currentUser, loading: true },
}

export const ConflictOnSave: Story = {
  args: { user: currentUser, conflictOnSave: true },
  parameters: {
    docs: { story: { description: '保存時に 409（版不一致）を受けると Alert(warning) で再取得を促す。' } },
  },
}

export const ErrorState: Story = {
  args: { user: currentUser, error: '対象の利用者が見つかりません' },
}
