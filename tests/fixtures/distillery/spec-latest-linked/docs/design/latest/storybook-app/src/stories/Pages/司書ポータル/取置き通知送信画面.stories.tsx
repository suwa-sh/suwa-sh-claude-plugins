import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { NotificationLogSection } from '@/components/common/NotificationLogSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Alert } from '@/components/ui/Feedback'
import { Card, CardHeader } from '@/components/ui/Card'
import type { NotificationLog } from '@/components/domain/NotificationLogTable'

/**
 * 取置き通知送信画面（/staff/holds/notify）。
 * HoldNoticeSendPanel（Card + Button(default) + Alert）+ HoldNoticeLogSection（NotificationLogTable + ToggleGroup）を、
 * 共通コンポーネント NotificationLogSection（notificationType="取置き通知"）+ FilterPanel（通知種別の絞り込み）の
 * 薄いアダプタとして実装する。送信は 202 受付の非同期処理のため、受付直後は「送信待ち」を表示する。
 */

const target = {
  reservationId: 'R-0007',
  bookTitle: '吾輩は猫である',
  userNumber: 'U-0001',
}

const baseLogs: NotificationLog[] = [
  {
    notificationId: 'N-0001',
    type: '取置き案内',
    timing: '期限当日',
    userNumber: 'U-0001',
    maskedEmail: 't***@example.com',
    sentAt: '2026-09-02T10:00:00',
    result: '成功',
    state: '送信済み',
  },
  {
    notificationId: 'N-0002',
    type: '取置き案内',
    timing: '期限当日',
    userNumber: 'U-0002',
    maskedEmail: 'k***@example.jp',
    state: '送信失敗',
  },
]

interface ScreenProps {
  sendable?: boolean
  logs: NotificationLog[]
  loading?: boolean
}

function HoldNoticeSendScreen({ sendable = true, logs, loading = false }: ScreenProps) {
  const [type, setType] = React.useState<string[]>(['取置き案内'])
  const [sending, setSending] = React.useState(false)
  const [items, setItems] = React.useState(logs)

  const filtered = items.filter((l) => type.length === 0 || l.type === type[0])
  const counts = {
    送信待ち: items.filter((l) => l.state === '送信待ち').length,
    送信済み: items.filter((l) => l.state === '送信済み').length,
    送信失敗: items.filter((l) => l.state === '送信失敗').length,
  }

  const typeFields: FilterFieldSpec[] = [
    {
      key: 'type',
      label: '通知種別の絞り込み',
      kind: 'single',
      options: [
        { value: '取置き案内', label: '取置き案内' },
        { value: '返却期限リマインド', label: '返却期限リマインド' },
        { value: '延滞督促', label: '延滞督促' },
      ],
      value: type,
    },
  ]

  return (
    <PortalPageLayout
      portal="staff"
      title="取置き通知送信"
      description="取置き案内の送信実行と送信実績を確認できます。"
      breadcrumb={[{ label: '予約管理' }, { label: '取置き通知送信' }]}
      width="contained"
      activeNavId="reservation"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        <Card flush style={{ padding: 'var(--card-padding)' }}>
          <CardHeader
            title="送信対象"
            description={`予約 ${target.reservationId}「${target.bookTitle}」/ 宛先利用者番号 ${target.userNumber}`}
          />
        </Card>
        {!sendable && (
          <Alert tone="warning" title="取置き案内を送信できません">
            根拠条件「取置き通知対象条件」を満たしていません。
          </Alert>
        )}
        <FilterPanel
          fields={typeFields}
          onChange={(_key, value) => setType(Array.isArray(value) ? value : [value])}
          onSubmit={() => {}}
          resultCount={filtered.length}
          collapsedByDefault={false}
        />
        <NotificationLogSection
          notificationType="取置き通知"
          counts={counts}
          logs={filtered}
          loading={loading}
          sending={sending}
          onSend={() => {
            if (!sendable) return
            setSending(true)
            setItems((prev) => [
              {
                notificationId: `N-${Math.floor(Math.random() * 9000 + 1000)}`,
                type: '取置き案内',
                timing: '期限当日',
                userNumber: target.userNumber,
                maskedEmail: 't***@example.com',
                state: '送信待ち',
              },
              ...prev,
            ])
            setTimeout(() => setSending(false), 600)
          }}
          onRetry={(log) =>
            setItems((prev) => prev.map((l) => (l.notificationId === log.notificationId ? { ...l, state: '送信待ち' } : l)))
          }
        />
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof HoldNoticeSendScreen> = {
  title: 'Pages/司書ポータル/取置き通知送信画面',
  component: HoldNoticeSendScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '取置き通知送信画面（/staff/holds/notify）。取置き案内の送信実行・送信実績の確認・送信失敗の再送を提供する。未達（送信失敗）は上部の警告で件数を知らせる。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof HoldNoticeSendScreen>

export const WithFailures: Story = {
  render: () => <HoldNoticeSendScreen logs={baseLogs} />,
}

export const NotSendable: Story = {
  render: () => <HoldNoticeSendScreen logs={[]} sendable={false} />,
}

export const AllSent: Story = {
  render: () => (
    <HoldNoticeSendScreen
      logs={baseLogs.map((l) => ({ ...l, state: '送信済み' as const, sentAt: '2026-09-02T10:00:00', result: '成功' }))}
    />
  ),
}

export const Loading: Story = {
  render: () => <HoldNoticeSendScreen logs={[]} loading />,
}
