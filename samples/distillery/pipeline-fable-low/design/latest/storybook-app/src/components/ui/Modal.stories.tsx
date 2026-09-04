import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Modal } from './Modal'
import { Button } from './Button'

const meta: Meta<typeof Modal> = {
  title: 'UI/Modal',
  component: Modal,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof Modal>

export const Confirm: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <div className="relative" style={{ height: 320 }}>
        <Button onClick={() => setOpen(true)}>返却通知を送信する</Button>
        <Modal inline open={open} title="返却通知を送信しますか" description="予約順位 1 位の 佐藤 太郎 さんへメールを送信します" confirmLabel="送信する" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </div>
    )
  },
}
export const DestructiveConfirm: Story = {
  render: function Render() {
    const [open, setOpen] = useState(true)
    return (
      <div className="relative" style={{ height: 320 }}>
        <Button variant="destructive" onClick={() => setOpen(true)}>削除する</Button>
        <Modal inline open={open} tone="destructive-confirm" title="書籍を削除しますか" description="「吾輩は猫である」を蔵書から除外します。この操作は取り消せません" confirmLabel="削除する" onConfirm={() => setOpen(false)} onCancel={() => setOpen(false)} />
      </div>
    )
  },
}
export const Submitting: Story = {
  render: () => (
    <div className="relative" style={{ height: 320 }}>
      <Modal inline open submitting title="貸出を確定しますか" description="送信中はボタンを無効化します（SR-005）" onConfirm={() => undefined} onCancel={() => undefined} />
    </div>
  ),
}
