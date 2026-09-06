import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Modal } from './Modal'
import { Button } from './Button'
import { Alert } from './Feedback'

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof Modal>

const Wrapper: React.FC<{
  title: string
  description: string
  body?: React.ReactNode
  destructive?: boolean
  confirmLabel: string
}> = ({ title, description, body, destructive, confirmLabel }) => {
  const [open, setOpen] = React.useState(true)
  return (
    <div style={{ padding: 'var(--page-padding)', minHeight: '24rem' }}>
      <Button onClick={() => setOpen(true)}>ダイアログを開く</Button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        description={description}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              やめる
            </Button>
            <Button
              variant={destructive ? 'destructive' : 'default'}
              onClick={() => setOpen(false)}
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        {body}
      </Modal>
    </div>
  )
}

export const Confirm: Story = {
  render: () => (
    <Wrapper
      title="予約を取り消しますか"
      description="『統計学が最強の学問である』の予約を取り消します。後続順位の方へ繰り上がります。"
      confirmLabel="予約を取り消す"
    />
  ),
}

export const DestructiveConfirm: Story = {
  render: () => (
    <Wrapper
      title="この書籍を除籍しますか"
      description="除籍すると蔵書一覧から外れます。この操作は取り消せません。"
      destructive
      confirmLabel="除籍する"
      body={
        <Alert tone="warning" title="蔵書削除制限ポリシー">
          貸出中・予約待ちの書籍は除籍できません。対象は「在庫あり」の 1 冊です。
        </Alert>
      }
    />
  ),
}
