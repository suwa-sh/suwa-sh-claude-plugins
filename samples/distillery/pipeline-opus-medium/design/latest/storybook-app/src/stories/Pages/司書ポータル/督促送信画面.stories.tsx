import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { NotificationLogSection } from '@/components/common/NotificationLogSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Pagination } from '@/components/ui/Pagination'
import { Alert } from '@/components/ui/Feedback'
import type { NotificationLog } from '@/components/domain/NotificationLogTable'

/**
 * 督促送信画面（/staff/overdues/dun）。
 * DunNotificationLog（NotificationLogTable）+ DunFailureAlert（Alert(destructive)）を、
 * 共通コンポーネント NotificationLogSection（notificationType="督促"）+ FilterPanel（通知状態の絞り込み）の
 * 薄いアダプタとして実装する。通知種別は本画面で「延滞督促」に固定する。
 */

const baseLogs: NotificationLog[] = [
  {
    notificationId: 'N-4001',
    type: '延滞督促',
    timing: '期限超過督促',
    userNumber: 'U-000123',
    maskedEmail: 't***@example.com',
    state: '送信失敗',
  },
  {
    notificationId: 'N-4002',
    type: '延滞督促',
    timing: '期限超過督促',
    userNumber: 'U-000456',
    maskedEmail: 's***@example.jp',
    sentAt: '2026-09-02T09:00:00',
    result: '成功',
    state: '送信済み',
  },
  {
    notificationId: 'N-4003',
    type: '延滞督促',
    timing: '期限超過督促',
    userNumber: 'U-000789',
    maskedEmail: 'y***@example.jp',
    state: '送信待ち',
  },
]

interface ScreenProps {
  logs: NotificationLog[]
  loading?: boolean
}

function DunSendScreen({ logs, loading = false }: ScreenProps) {
  const [status, setStatus] = React.useState<string[]>([])
  const [resent, setResent] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  const filtered = status.length === 0 ? logs : logs.filter((l) => l.state === status[0])
  const counts = {
    送信待ち: logs.filter((l) => l.state === '送信待ち').length,
    送信済み: logs.filter((l) => l.state === '送信済み').length,
    送信失敗: logs.filter((l) => l.state === '送信失敗').length,
  }

  const statusFields: FilterFieldSpec[] = [
    {
      key: 'status',
      label: '通知状態の絞り込み',
      kind: 'single',
      options: [
        { value: '送信待ち', label: '送信待ち' },
        { value: '送信済み', label: '送信済み' },
        { value: '送信失敗', label: '送信失敗' },
      ],
      value: status,
    },
  ]

  return (
    <PortalPageLayout
      portal="staff"
      title="督促送信"
      description="延滞督促の送信実績を確認し、未達を再送できます。"
      breadcrumb={[{ label: '期限・督促' }, { label: '督促送信' }]}
      width="full"
      activeNavId="duedate"
    >
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)' }}>
        {resent && (
          <Alert tone="success" title="再送を受け付けました">
            通知「{resent}」の再送を受け付けました。
          </Alert>
        )}
        <FilterPanel
          fields={statusFields}
          onChange={(_key, value) => setStatus(Array.isArray(value) ? value : [value])}
          onSubmit={() => {}}
          onReset={() => setStatus([])}
          resultCount={filtered.length}
          collapsedByDefault={false}
        />
        <NotificationLogSection
          notificationType="督促"
          counts={counts}
          logs={filtered}
          loading={loading}
          sending={sending}
          onSend={() => {
            setSending(true)
            setTimeout(() => setSending(false), 600)
          }}
          onRetry={(log) => setResent(log.notificationId)}
        />
        <Pagination page={1} totalPages={1} onChange={() => {}} totalCount={filtered.length} pageSize={20} />
      </div>
    </PortalPageLayout>
  )
}

const meta: Meta<typeof DunSendScreen> = {
  title: 'Pages/司書ポータル/督促送信画面',
  component: DunSendScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '督促送信画面（/staff/overdues/dun）。未達（送信失敗）件数を Alert(destructive) で上部に出し、送信失敗の行だけに再送操作を出す。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof DunSendScreen>

export const Default: Story = {
  render: () => <DunSendScreen logs={baseLogs} />,
}

export const AllSent: Story = {
  render: () => <DunSendScreen logs={baseLogs.map((l) => ({ ...l, state: '送信済み' as const, sentAt: '2026-09-02T09:00:00', result: '成功' }))} />,
}

export const Loading: Story = {
  render: () => <DunSendScreen logs={[]} loading />,
}

export const Empty: Story = {
  render: () => <DunSendScreen logs={[]} />,
}
