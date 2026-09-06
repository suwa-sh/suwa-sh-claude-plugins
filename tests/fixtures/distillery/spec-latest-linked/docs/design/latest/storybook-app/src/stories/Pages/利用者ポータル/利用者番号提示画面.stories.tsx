import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Card } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'

/**
 * 利用者番号提示画面（/mypage/card）。
 * 例外画面: sm を主対象とし、width="contained" かつ利用者番号を最大サイズ（等幅・3xl 相当）で表示する。
 * UC 固有コンポーネント PatronCardPanel は Card（UI）の薄いアダプタとして実装する。
 * UserProfileCard（Domain）の連絡先マスクは既定 true のまま（本画面では開示ボタンを出さない）。
 */

const patron: UserProfileCardUser = {
  userNumber: 'U-000123',
  name: '田中太郎',
  email: 'tanaka@example.jp',
  category: '一般',
  state: '登録済み',
  registeredAt: '2024-04-01',
}

function PatronCardScreen({ mode = 'default' }: { mode?: 'default' | 'loading' | 'error' }) {
  const loading = mode === 'loading'
  const error = mode === 'error'

  return (
    <PortalPageLayout
      portal="patron"
      title="利用者番号を提示"
      breadcrumb={[{ label: '登録内容', href: '#' }, { label: '利用者番号を提示' }]}
      activeNavId="mypage"
      width="contained"
      collapsed
    >
      <AsyncSection
        loading={loading}
        error={error ? '利用者情報を取得できませんでした。時間をおいて再度お試しください' : null}
        isEmpty={false}
        skeleton="line"
        emptyMessage="利用者情報がありません"
        onRetry={error ? () => undefined : undefined}
        announce
      >
        <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
          <Alert tone="info" title="この画面を窓口で司書にご提示ください" />

          <Card>
            <div className="flex flex-col items-center" style={{ gap: 'var(--spacing-2)', textAlign: 'center' }}>
              <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--foreground-muted)' }}>
                利用者番号
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-family-mono)',
                  fontVariantNumeric: 'tabular-nums',
                  fontSize: 'var(--font-size-3xl)',
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  color: 'var(--foreground)',
                }}
              >
                {patron.userNumber}
              </span>
            </div>
          </Card>

          <UserProfileCard user={patron} maskContact />
        </div>
      </AsyncSection>
    </PortalPageLayout>
  )
}

const meta = {
  title: 'Pages/利用者ポータル/利用者番号提示画面',
  component: PatronCardScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile1' },
    docs: {
      description: {
        component:
          '利用者番号提示画面（例外画面: sm 主対象・width="contained"）。Card（等幅 3xl の利用者番号）+ UserProfileCard（Domain、連絡先マスク既定）の合成。',
      },
    },
  },
} satisfies Meta<typeof PatronCardScreen>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => <PatronCardScreen mode="default" />,
}

export const Loading: Story = {
  render: () => <PatronCardScreen mode="loading" />,
}

export const FetchFailed: Story = {
  render: () => <PatronCardScreen mode="error" />,
}
