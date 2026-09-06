import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { AsyncSection } from '@/components/common/AsyncSection'
import { Card, CardHeader } from '@/components/ui/Card'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { ToggleGroup } from '@/components/ui/ToggleGroup'
import { ReservationQueueTracker } from '@/components/domain/ReservationQueueTracker'
import { UserProfileCard, type UserProfileCardUser } from '@/components/domain/UserProfileCard'

/**
 * 取置き対象者特定画面（/staff/holds/next）。
 * HoldCandidatePanel（Card + ReservationQueueTracker + ReservationStatusBadge + UserProfileCard）を、
 * 共通コンポーネント AsyncSection + PiiMaskedText（UserProfileCard 内部）の薄いアダプタとして実装する。
 * 判定が「対象外」のときは根拠となった RDRA 条件名を Alert(warning) に展開する（反応型オンボーディング）。
 */

const TODAY = '2026-09-02'

const pendingBooks = [
  { value: 'B-0001', label: '吾輩は猫である（B-0001）' },
  { value: 'B-0002', label: '銀河鉄道の夜（B-0002）' },
  { value: 'B-0003', label: '坊っちゃん（B-0003）' },
]

interface Candidate {
  bookTitle: string
  reservationId: string
  totalReservations: number
  notifiable: boolean
  reasonCondition?: string
  hasCandidate: boolean
  user?: UserProfileCardUser
}

const candidates: Record<string, Candidate> = {
  'B-0001': {
    bookTitle: '吾輩は猫である',
    reservationId: 'R-0007',
    totalReservations: 3,
    notifiable: true,
    hasCandidate: true,
    user: {
      userNumber: 'U-0001',
      name: '田中太郎',
      email: 'tanaka@example.com',
      category: '一般',
      state: '登録済み',
      registeredAt: '2024-04-01',
    },
  },
  'B-0002': {
    bookTitle: '銀河鉄道の夜',
    reservationId: '',
    totalReservations: 0,
    notifiable: false,
    hasCandidate: false,
  },
  'B-0003': {
    bookTitle: '坊っちゃん',
    reservationId: '',
    totalReservations: 0,
    notifiable: false,
    reasonCondition: '取置き通知対象条件',
    hasCandidate: true,
  },
}

interface ScreenProps {
  initialBookId?: string
  loading?: boolean
  error?: string | null
}

function HoldCandidateScreen({ initialBookId = 'B-0001', loading = false, error = null }: ScreenProps) {
  const [bookId, setBookId] = React.useState(initialBookId)
  const [revealed, setRevealed] = React.useState(false)
  const candidate = candidates[bookId]

  return (
    <PortalPageLayout
      portal="staff"
      title="取置き対象者特定"
      description="予約待ちの書籍から取置き通知対象（予約順1位）を特定します。"
      breadcrumb={[{ label: '予約管理' }, { label: '取置き対象者特定' }]}
      width="contained"
      activeNavId="reservation"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <ToggleGroup
          label="対象書籍"
          options={pendingBooks}
          mode="single"
          value={[bookId]}
          onChange={(v) => setBookId(v[0] ?? bookId)}
        />
        <AsyncSection
          loading={loading}
          error={error}
          isEmpty={!loading && !error && !candidate.hasCandidate}
          skeleton="line"
          emptyTitle="取置き対象の予約がありません"
          emptyMessage="別の書籍を選び直してください。"
          onRetry={() => {}}
        >
          <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
            {candidate.notifiable ? (
              <Card>
                <CardHeader title="候補予約" description={`${candidate.bookTitle} の予約順位 1 位`} />
                <ReservationQueueTracker
                  state="予約中"
                  rank={1}
                  totalReservations={candidate.totalReservations}
                  today={TODAY}
                  bookTitle={candidate.bookTitle}
                />
              </Card>
            ) : (
              <Alert tone="warning" title="取置き通知対象外です">
                根拠条件「{candidate.reasonCondition ?? '取置き通知対象条件'}」を満たしていません。
              </Alert>
            )}

            {candidate.user && (
              <UserProfileCard
                user={candidate.user}
                maskContact={!revealed}
                actions={
                  <Button
                    variant="default"
                    iconRight="arrow-right"
                    disabled={!candidate.notifiable}
                    onClick={() => setRevealed(revealed)}
                  >
                    取置き通知へ進む
                  </Button>
                }
              />
            )}
          </div>
        </AsyncSection>
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof HoldCandidateScreen> = {
  title: 'Pages/司書ポータル/取置き対象者特定画面',
  component: HoldCandidateScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '取置き対象者特定画面（/staff/holds/next）。予約待ちとなった書籍の取置き通知対象（予約順1位）を提示する。対象外のときは根拠条件を Alert(warning) に展開する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof HoldCandidateScreen>

export const Default: Story = {
  render: () => <HoldCandidateScreen initialBookId="B-0001" />,
}

export const NotEligible: Story = {
  render: () => <HoldCandidateScreen initialBookId="B-0003" />,
}

export const NoCandidate: Story = {
  render: () => <HoldCandidateScreen initialBookId="B-0002" />,
}

export const Loading: Story = {
  render: () => <HoldCandidateScreen initialBookId="B-0001" loading />,
}

export const ErrorState: Story = {
  render: () => <HoldCandidateScreen initialBookId="B-0001" error="候補を取得できませんでした" />,
}
