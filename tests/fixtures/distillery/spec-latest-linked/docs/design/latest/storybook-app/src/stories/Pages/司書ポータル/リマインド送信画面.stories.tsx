import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { NotificationLogSection } from '@/components/common/NotificationLogSection'
import { FilterPanel, type FilterFieldSpec } from '@/components/common/FilterPanel'
import { Pagination } from '@/components/ui/Pagination'
import { Alert } from '@/components/ui/Feedback'
import type { NotificationLog } from '@/components/domain/NotificationLogTable'

/**
 * リマインド送信画面（/staff/duedates/remind）。
 * RemindNotificationLog（NotificationLogTable）+ NotificationSendSummary を、
 * 共通コンポーネント NotificationLogSection（notificationType="リマインド"）+ FilterPanel（通知タイミング区分の絞り込み）の
 * 薄いアダプタとして実装する。通知種別は本画面で「返却期限リマインド」に固定する。
 */

const baseLogs: NotificationLog[] = [
  {
    notificationId: 'N-2001',
    type: '返却期限リマインド',
    timing: '期限前リマインド',
    userNumber: 'U-000111',
    maskedEmail: 't***@example.com',
    state: '送信失敗',
  },
  {
    notificationId: 'N-2002',
    type: '返却期限リマインド',
    timing: '期限当日',
    userNumber: 'U-000222',
    maskedEmail: 'k***@example.jp',
    sentAt: '2026-09-02T08:00:00',
    result: '成功',
    state: '送信済み',
  },
  {
    notificationId: 'N-2003',
    type: '返却期限リマインド',
    timing: '期限前リマインド',
    userNumber: 'U-000333',
    maskedEmail: 'm***@example.jp',
    state: '送信待ち',
  },
]

interface ScreenProps {
  logs: NotificationLog[]
  loading?: boolean
}

function RemindSendScreen({ logs, loading = false }: ScreenProps) {
  const [timing, setTiming] = React.useState<string[]>([])
  const [resent, setResent] = React.useState<string | null>(null)
  const [sending, setSending] = React.useState(false)

  const filtered = timing.length === 0 ? logs : logs.filter((l) => l.timing === timing[0])
  const counts = {
    送信待ち: logs.filter((l) => l.state === '送信待ち').length,
    送信済み: logs.filter((l) => l.state === '送信済み').length,
    送信失敗: logs.filter((l) => l.state === '送信失敗').length,
  }

  const timingFields: FilterFieldSpec[] = [
    {
      key: 'timing',
      label: '通知タイミング区分の絞り込み',
      kind: 'single',
      options: [
        { value: '期限前リマインド', label: '期限前リマインド' },
        { value: '期限当日', label: '期限当日' },
      ],
      value: timing,
    },
  ]

  return (
    <PortalPageLayout
      portal="staff"
      title="リマインド送信"
      description="返却期限リマインドの送信実績を確認し、未達を再送できます。"
      breadcrumb={[{ label: '期限・督促' }, { label: 'リマインド送信' }]}
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
          fields={timingFields}
          onChange={(_key, value) => setTiming(Array.isArray(value) ? value : [value])}
          onSubmit={() => {}}
          onReset={() => setTiming([])}
          resultCount={filtered.length}
          collapsedByDefault={false}
        />
        <NotificationLogSection
          notificationType="リマインド"
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

const meta: Meta<typeof RemindSendScreen> = {
  title: 'Pages/司書ポータル/リマインド送信画面',
  component: RemindSendScreen,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'リマインド送信画面（/staff/duedates/remind）。送信状態サマリを先頭に置き、未達（送信失敗）は Alert(destructive) で明示する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof RemindSendScreen>

export const Default: Story = {
  render: () => <RemindSendScreen logs={baseLogs} />,
}

export const AllSent: Story = {
  render: () => (
    <RemindSendScreen
      logs={baseLogs.map((l) => ({ ...l, state: '送信済み' as const, sentAt: '2026-09-02T08:00:00', result: '成功' }))}
    />
  ),
}

export const Loading: Story = {
  render: () => <RemindSendScreen logs={[]} loading />,
}

export const Empty: Story = {
  render: () => <RemindSendScreen logs={[]} />,
}
