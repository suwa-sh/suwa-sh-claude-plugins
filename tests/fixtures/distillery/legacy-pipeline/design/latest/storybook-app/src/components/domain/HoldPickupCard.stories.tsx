import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HoldPickupCard } from './HoldPickupCard'

const meta = {
  title: 'Domain/HoldPickupCard',
  component: HoldPickupCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof HoldPickupCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    bookTitle: '瀬戸内の民具と暮らし',
    author: '槇原 令子',
    holdStartAt: '2026-05-08T10:30:00+09:00',
    holdDeadline: '2026-05-15T19:00:00+09:00',
    userNumber: 'U-100238',
    today: '2026-05-09',
    variant: 'default',
    onCancel: () => {},
  },
}

export const DeadlineToday: Story = {
  args: {
    bookTitle: '夜明けの図書室',
    author: '芦田 悠里',
    holdStartAt: '2026-05-03T14:05:00+09:00',
    holdDeadline: '2026-05-10T19:00:00+09:00',
    userNumber: 'U-100511',
    today: '2026-05-10',
    variant: 'deadline-today',
    onCancel: () => {},
  },
}
