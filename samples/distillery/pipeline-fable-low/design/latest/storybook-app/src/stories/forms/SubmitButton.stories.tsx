import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { SubmitButton } from '@/components/common/SubmitButton'

const meta: Meta<typeof SubmitButton> = {
  title: 'Common/SubmitButton',
  component: SubmitButton,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof SubmitButton>

export const Idle: Story = {
  args: { label: '登録', submitting: false },
}

export const Submitting: Story = {
  args: { label: '登録', submitting: true },
}

export const Destructive: Story = {
  args: { label: '削除する', submitting: false, variant: 'destructive' },
}
