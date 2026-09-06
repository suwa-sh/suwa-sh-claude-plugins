import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { DataListSection } from '@/components/common/DataListSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Button } from '@/components/ui/Button'
import { UserTable, type User } from '@/components/domain/UserTable'
import { userCategories } from '@/components/domain/stateMaps'

/**
 * 利用者名簿画面（/staff/users）。
 * 利用者一覧の取得・絞り込み・ページングと連絡先の常時マスク表示を実装する。
 * 共通コンポーネント: PortalPageLayout + DataListSection（AsyncSection + UserTable + Pagination）+ FilterPanel。
 */

const allUsers: User[] = [
  { userNumber: 'U-000123', name: '田中太郎', email: 'tanaka@example.com', category: '一般', state: '登録済み', activeLoans: 1, activeReservations: 0 },
  { userNumber: 'U-000200', name: '鈴木一郎', email: 'suzuki@example.com', category: '一般', state: '取引進行中', activeLoans: 1, activeReservations: 1 },
  { userNumber: 'U-000301', name: '佐藤花子', email: 'sato@example.com', category: '学生', state: '登録済み', activeLoans: 0, activeReservations: 0 },
  { userNumber: 'U-000410', name: '山田図書サークル', email: 'circle@example.com', category: '団体', state: '登録済み', activeLoans: 3, activeReservations: 0 },
]

interface ScreenProps {
  users: User[]
  total: number
  loading?: boolean
  error?: string | null
}

function UserRosterScreen({ users, total, loading = false, error = null }: ScreenProps) {
  const [page, setPage] = React.useState(1)
  const [category, setCategory] = React.useState<string[]>([])
  const totalPages = Math.max(1, Math.ceil(total / 20))

  return (
    <PortalPageLayout
      portal="staff"
      title="利用者名簿"
      description="登録済みの利用者を確認・管理できます。"
      breadcrumb={[{ label: '利用者管理' }, { label: '利用者名簿' }]}
      activeNavId="user"
      width="full"
      actions={
        <Button variant="default" iconLeft="user-plus">
          利用申込を受け付ける
        </Button>
      }
    >
      <DataListSection
        filter={
          <FilterPanel
            fields={
              [
                {
                  key: 'category',
                  label: '利用者区分',
                  kind: 'single',
                  options: userCategories.map((c) => ({ value: c, label: c })),
                  value: category,
                },
              ] as FilterFieldSpec[]
            }
            onChange={(_key, v) => setCategory(Array.isArray(v) ? v : [v])}
            onSubmit={() => setPage(1)}
            onReset={() => {
              setCategory([])
              setPage(1)
            }}
            resultCount={total}
            collapsedByDefault={false}
          />
        }
        loading={loading}
        error={error}
        isEmpty={!loading && !error && users.length === 0}
        emptyMessage="該当する利用者はいません"
        emptyAction={
          <Button variant="outline" onClick={() => setCategory([])}>
            絞り込みを解除する
          </Button>
        }
        onRetry={() => {}}
        total={total}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        table={
          <UserTable
            users={users}
            loading={loading}
            error={error ?? undefined}
            actionsFor={(u) => (
              <>
                <Button variant="outline" size="sm" iconLeft="edit">
                  編集
                </Button>
                {u.activeLoans === 0 && u.activeReservations === 0 && (
                  <Button variant="destructive" size="sm" iconLeft="user-plus">
                    退会
                  </Button>
                )}
              </>
            )}
          />
        }
      />
    </PortalPageLayout>
  )
}

const meta: Meta<typeof UserRosterScreen> = {
  title: 'Pages/司書ポータル/利用者名簿画面',
  component: UserRosterScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '利用者名簿画面（/staff/users）。利用者一覧の取得・絞り込み・ページングと連絡先の常時マスク表示を実装する。PortalPageLayout + DataListSection（AsyncSection + UserTable + Pagination）+ FilterPanel の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof UserRosterScreen>

export const Default: Story = {
  args: { users: allUsers, total: allUsers.length },
}

export const Loading: Story = {
  args: { users: [], total: 0, loading: true },
}

export const Empty: Story = {
  args: { users: [], total: 0 },
}

export const ManyPages: Story = {
  args: { users: allUsers, total: 25 },
  parameters: {
    docs: { story: { description: '21 件以上は Pagination で分割表示する（20 件/頁）。' } },
  },
}

export const ErrorState: Story = {
  args: { users: [], total: 0, error: '利用者名簿を取得できませんでした' },
}
