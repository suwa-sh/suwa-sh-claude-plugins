import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { EntityFormPage } from '@/components/common/EntityFormPage'
import { UserForm } from '@/components/domain/Forms'
import { Badge } from '@/components/ui/Badge'
import { PiiMaskedText } from '@/components/domain/PiiMaskedText'
import { sampleUsers } from '@/components/domain/sampleData'

interface UserEditPageProps {
  submitting?: boolean
}

/** 利用者編集画面（/staff/users/:userId/edit）。EntityFormPage(edit) + UserForm(edit)。 */
const UserEditPage: React.FC<UserEditPageProps> = ({ submitting = false }) => {
  const user = sampleUsers[0]
  return (
    <StaffLayout activeGroup="users" activeItem="userEdit" userName="佐藤 花子">
      <EntityFormPage mode="edit" title="利用者を編集" status={<Badge variant="outline">利用者</Badge>} submitting={submitting} onCancel={() => {}}>
        {() => (
          <div className="flex flex-col" style={{ gap: 'var(--spacing-4)' }}>
            <div className="flex flex-wrap items-center" style={{ gap: 'var(--spacing-4)', fontSize: 'var(--font-size-sm)' }}>
              <span style={{ color: 'var(--foreground-secondary)' }}>連絡先の現在値</span>
              <PiiMaskedText value={user.email} kind="email" />
              <PiiMaskedText value={user.phone} kind="phone" />
            </div>
            <UserForm mode="edit" userNumber={user.number} initial={user} submitting={submitting} onSubmit={() => {}} onCancel={() => {}} />
          </div>
        )}
      </EntityFormPage>
    </StaffLayout>
  )
}

const meta: Meta<typeof UserEditPage> = {
  title: 'Pages/司書ポータル/利用者編集画面',
  component: UserEditPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UserEditPage>

export const Default: Story = {
  render: () => <UserEditPage />,
}

export const Submitting: Story = {
  render: () => <UserEditPage submitting />,
}
