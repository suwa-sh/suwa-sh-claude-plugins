import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { NotificationLogTable } from './NotificationLogTable'
import type { NotificationLog } from './NotificationLogTable'

const meta = {
  title: 'Domain/NotificationLogTable',
  component: NotificationLogTable,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof NotificationLogTable>

export default meta
type Story = StoryObj<typeof meta>

const logs: NotificationLog[] = [
  {
    notificationId: 'NT-20260901-0001',
    type: '取置き案内',
    timing: '期限前リマインド',
    userNumber: 'U-2024-000318',
    maskedEmail: 't****@example.jp',
    sentAt: '2026-09-01T09:12:00',
    result: '正常終了',
    state: '送信済み',
  },
  {
    notificationId: 'NT-20260901-0002',
    type: '返却期限リマインド',
    timing: '期限当日',
    userNumber: 'U-2023-001204',
    maskedEmail: 'n****@example.jp',
    sentAt: '2026-09-01T09:12:03',
    result: '正常終了',
    state: '送信済み',
  },
  {
    notificationId: 'NT-20260901-0003',
    type: '延滞督促',
    timing: '期限超過督促',
    userNumber: 'U-2022-000087',
    maskedEmail: 'm****@example.jp',
    state: '送信待ち',
  },
]

const failedLogs: NotificationLog[] = [
  ...logs,
  {
    notificationId: 'NT-20260901-0004',
    type: '延滞督促',
    timing: '期限超過督促',
    userNumber: 'U-2025-000042',
    maskedEmail: 'i****@example.jp',
    sentAt: '2026-09-01T09:12:07',
    result: '宛先不明（メールボックス未検出）',
    state: '送信失敗',
  },
  {
    notificationId: 'NT-20260901-0005',
    type: '取置き案内',
    timing: '期限前リマインド',
    userNumber: 'U-2024-000512',
    maskedEmail: 's****@example.jp',
    sentAt: '2026-09-01T09:12:09',
    result: '送信サーバ一時エラー',
    state: '送信失敗',
  },
]

export const Default: Story = {
  args: { logs },
}

export const WithFailures: Story = {
  args: {
    logs: failedLogs,
    onRetry: (log) => window.alert(`再送: ${log.notificationId}`),
  },
}

export const Loading: Story = {
  args: { logs: [], loading: true },
}

export const Empty: Story = {
  args: { logs: [] },
}
