import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NotificationLogSection } from '@/components/common/NotificationLogSection'

const meta: Meta<typeof NotificationLogSection> = {
  title: 'Common/NotificationLogSection',
  component: NotificationLogSection,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component:
          '通知 3 UC（取置き通知 / リマインド / 督促）が同一構造を持つためのテンプレート（NotificationLogTable + NotificationStatusBadge + Alert + SubmitActionButton の合成）。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof NotificationLogSection>

const logs = [
  {
    notificationId: 'N-001',
    type: '取置き案内',
    timing: '期限前リマインド',
    userNumber: 'U-000123',
    maskedEmail: 'h***@example.jp',
    sentAt: '2026-09-01T10:00:00',
    result: '成功',
    state: '送信済み' as const,
  },
  {
    notificationId: 'N-002',
    type: '取置き案内',
    timing: '期限前リマインド',
    userNumber: 'U-000456',
    maskedEmail: 't***@example.jp',
    state: '送信失敗' as const,
  },
  {
    notificationId: 'N-003',
    type: '取置き案内',
    timing: '期限前リマインド',
    userNumber: 'U-000789',
    maskedEmail: 'y***@example.jp',
    state: '送信待ち' as const,
  },
]

export const WithFailures: Story = {
  args: {
    notificationType: '取置き通知',
    counts: { 送信待ち: 1, 送信済み: 1, 送信失敗: 1 },
    logs,
    onSend: () => {},
    onRetry: () => {},
  },
}

export const AllSent: Story = {
  args: {
    notificationType: 'リマインド',
    counts: { 送信待ち: 0, 送信済み: 3, 送信失敗: 0 },
    logs: logs.map((l) => ({ ...l, state: '送信済み' as const })),
    onSend: () => {},
  },
}
