import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { EntityFormPage } from '@/components/common/EntityFormPage'
import { Alert } from '@/components/ui/Feedback'
import { UserForm, type UserFormErrors } from '@/components/domain/Forms'

interface UserRegisterPageProps {
  errors?: UserFormErrors
  registered?: { number: string; name: string }
}

/** 利用者登録画面（/staff/users/new）。EntityFormPage(create) + UserForm(create)。 */
const UserRegisterPage: React.FC<UserRegisterPageProps> = ({ errors = {}, registered }) => (
  <StaffLayout activeGroup="users" activeItem="userNew" userName="佐藤 花子">
    <EntityFormPage mode="create" title="利用者を登録" submitting={false} onCancel={() => {}}>
      {() => (
        <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
          {registered ? (
            <Alert tone="success" title={`利用者番号 ${registered.number} で登録しました`}>
              {registered.name} さんを利用者として登録しました。続けて別の利用者を登録するか、一覧へ戻ってください。
            </Alert>
          ) : null}
          <UserForm mode="create" errors={errors} onSubmit={() => {}} onCancel={() => {}} />
        </div>
      )}
    </EntityFormPage>
  </StaffLayout>
)

const meta: Meta<typeof UserRegisterPage> = {
  title: 'Pages/司書ポータル/利用者登録画面',
  component: UserRegisterPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UserRegisterPage>

export const Default: Story = {
  render: () => <UserRegisterPage />,
}

export const ValidationError: Story = {
  render: () => <UserRegisterPage errors={{ name: '氏名を入力してください', email: 'メールアドレスの形式が正しくありません' }} />,
}

export const Registered: Story = {
  render: () => <UserRegisterPage registered={{ number: 'U-000126', name: '田中 次郎' }} />,
}
