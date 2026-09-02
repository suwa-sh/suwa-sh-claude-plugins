import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SubmitActionButton } from '@/components/common/SubmitActionButton'

const meta: Meta<typeof SubmitActionButton> = {
  title: 'Common/SubmitActionButton',
  component: SubmitActionButton,
  tags: ['autodocs'],
  parameters: {
    docs: {
      description: {
        component:
          '更新系 API の二重送信防止を 1 箇所に集約する（Button の合成）。押下で disabled + aria-busy + loading にし、冪等キーを送る（arch SR-002 / LR-032）。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof SubmitActionButton>

export const Default: Story = {
  args: { variant: 'default', onSubmit: () => {}, children: '登録する' },
}

export const Destructive: Story = {
  args: { variant: 'destructive', onSubmit: () => {}, children: '除籍する' },
}

export const Submitting: Story = {
  args: { variant: 'default', onSubmit: () => {}, submitting: true, children: '登録する' },
}

export const Disabled: Story = {
  args: { variant: 'default', onSubmit: () => {}, disabled: true, children: '送信対象がありません' },
}
