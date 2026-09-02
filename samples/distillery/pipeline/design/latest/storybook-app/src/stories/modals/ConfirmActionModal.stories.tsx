import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ConfirmActionModal } from '@/components/common/ConfirmActionModal'
import { Button } from '@/components/ui/Button'

const meta: Meta<typeof ConfirmActionModal> = {
  title: 'Common/ConfirmActionModal',
  component: ConfirmActionModal,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '確認ダイアログの文言構造（対象名の再掲 → 影響の明示 → 取り消し可否）とフォーカス制御を統一する（Modal + Button + Alert の合成）。window.confirm の代替を禁止する。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof ConfirmActionModal>

export const Destructive: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true)
    return (
      <>
        <Button variant="destructive" onClick={() => setOpen(true)}>
          除籍する
        </Button>
        <ConfirmActionModal
          open={open}
          tone="destructive"
          title="この書籍を除籍しますか"
          targetLabel="吾輩は猫である（夏目漱石）"
          impact="除籍すると蔵書一覧から削除され、元に戻せません。"
          confirmLabel="除籍する"
          onConfirm={() => setOpen(false)}
          onCancel={() => setOpen(false)}
        />
      </>
    )
  },
}

export const Confirm: Story = {
  render: () => {
    const [open, setOpen] = React.useState(true)
    return (
      <ConfirmActionModal
        open={open}
        tone="confirm"
        title="この内容で予約を申し込みますか"
        targetLabel="銀河鉄道の夜（宮沢賢治）"
        impact="予約が確定し、順位確認画面へ移動します。"
        confirmLabel="予約する"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    )
  },
}

export const Submitting: Story = {
  args: {
    open: true,
    tone: 'destructive',
    title: '退会させますか',
    targetLabel: '山田 花子（U-000123）',
    impact: '退会すると利用者情報が削除され、貸出・予約はできなくなります。',
    confirmLabel: '退会させる',
    onConfirm: () => {},
    onCancel: () => {},
    submitting: true,
  },
}
