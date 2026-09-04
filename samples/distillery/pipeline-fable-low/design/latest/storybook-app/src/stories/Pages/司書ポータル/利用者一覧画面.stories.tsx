import React, { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { StaffLayout } from '@/components/common/StaffLayout'
import { PageHeader } from '@/components/common/PageHeader'
import { PaginatedListFrame } from '@/components/common/PaginatedListFrame'
import { KeywordSearchInput } from '@/components/common/KeywordSearchInput'
import { UserTable } from '@/components/domain/UserTable'
import { sampleUsers } from '@/components/domain/sampleData'
import type { User } from '@/components/domain/types'

interface UserListPageProps {
  users: User[]
  loading?: boolean
  empty?: boolean
}

/** 利用者一覧画面（/staff/users）。KeywordSearchInput + UserTable + Pagination（PaginatedListFrame 経由）。 */
const UserListPage: React.FC<UserListPageProps> = ({ users, loading = false, empty = false }) => {
  const [keyword, setKeyword] = useState('')
  return (
    <StaffLayout activeGroup="users" activeItem="userList" userName="佐藤 花子">
      <PageHeader title="利用者一覧" primaryAction={{ label: '利用者を登録', onClick: () => {} }} />
      <PaginatedListFrame
        filter={<KeywordSearchInput value={keyword} onChange={setKeyword} onSubmit={() => {}} placeholder="利用者番号または氏名で検索" />}
        page={1}
        totalCount={users.length}
        onPageChange={() => {}}
        loading={loading}
        error={null}
        empty={empty}
        emptyState={{ title: '該当する利用者がいません', action: { label: '利用者を登録', onClick: () => {} } }}
        skeleton={{ variant: 'table' }}
      >
        <UserTable users={users} onEdit={() => {}} onDelete={() => {}} onOpenStatus={() => {}} />
      </PaginatedListFrame>
    </StaffLayout>
  )
}

const meta: Meta<typeof UserListPage> = {
  title: 'Pages/司書ポータル/利用者一覧画面',
  component: UserListPage,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof UserListPage>

export const Default: Story = {
  render: () => <UserListPage users={sampleUsers} />,
}

export const Empty: Story = {
  render: () => <UserListPage users={[]} empty />,
}

export const Loading: Story = {
  render: () => <UserListPage users={[]} loading />,
}
