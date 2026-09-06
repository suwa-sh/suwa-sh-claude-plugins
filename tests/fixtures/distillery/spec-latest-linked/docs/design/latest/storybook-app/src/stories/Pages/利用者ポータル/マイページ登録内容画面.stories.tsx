import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Button } from '@/components/ui/Button'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'

/**
 * マイページ登録内容画面（/mypage）。
 * 本人の登録内容を UserProfileCard（既定マスク・明示操作で開示）で提示する。
 * 共通コンポーネント: PortalPageLayout + AsyncSection（読み込み中/取得失敗）。
 * 連絡先マスクは PiiMaskedText と同じ表現を内包する UserProfileCard を使う（common-components.md「そのまま使う」区分）。
 */

const sampleUser: UserProfileCardUser = {
  userNumber: 'U-000123',
  name: '田中太郎',
  email: 'tanaka@example.com',
  category: '一般',
  state: '登録済み',
  registeredAt: '2025-04-01',
}

const inTransactionUser: UserProfileCardUser = {
  ...sampleUser,
  userNumber: 'U-000456',
  name: '佐藤花子',
  email: 'sato@example.com',
  state: '取引進行中',
}

interface ScreenProps {
  user?: UserProfileCardUser
  loading?: boolean
  error?: string | null
}

function MyPageScreen({ user, loading = false, error = null }: ScreenProps) {
  return (
    <PortalPageLayout
      portal="patron"
      title="マイページ"
      description="登録内容を確認できます。"
      breadcrumb={[{ label: 'マイページ' }]}
      activeNavId="mypage"
      width="contained"
      actions={
        <Button variant="outline" iconLeft="id-card">
          利用者番号を提示する
        </Button>
      }
    >
      <AsyncSection
        loading={loading}
        error={error}
        isEmpty={!user}
        skeleton="line"
        emptyMessage="登録内容を取得できませんでした"
        onRetry={() => {}}
      >
        {user && (
          <UserProfileCard
            user={user}
            maskContact
            actions={
              <Button variant="outline" iconLeft="id-card">
                利用者番号を提示する
              </Button>
            }
          />
        )}
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof MyPageScreen> = {
  title: 'Pages/利用者ポータル/マイページ登録内容画面',
  component: MyPageScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'マイページ登録内容画面（/mypage）。本人の登録内容を UserProfileCard で提示し、連絡先は既定マスクで明示操作でのみ開示する。他利用者情報への導線は持たない（LP-025）。PortalPageLayout + AsyncSection の合成。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof MyPageScreen>

export const Default: Story = {
  args: { user: sampleUser },
}

export const InTransaction: Story = {
  args: { user: inTransactionUser },
  parameters: {
    docs: { story: { description: '利用者状態が「取引進行中」のときは UserStatusBadge が info 表示になる。' } },
  },
}

export const Loading: Story = {
  args: { loading: true },
}

export const ErrorState: Story = {
  args: { error: '登録内容を取得できませんでした。時間をおいて再度お試しください。' },
}
