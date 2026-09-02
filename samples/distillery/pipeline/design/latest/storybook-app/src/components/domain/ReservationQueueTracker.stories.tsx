import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ReservationQueueTracker } from './ReservationQueueTracker'

const meta = {
  title: 'Domain/ReservationQueueTracker',
  component: ReservationQueueTracker,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReservationQueueTracker>

export default meta
type Story = StoryObj<typeof meta>

const TODAY = '2026-05-10'

export const Waiting: Story = {
  args: {
    state: '予約中',
    rank: 3,
    totalReservations: 7,
    bookTitle: '夜明けの図書室',
    today: TODAY,
  },
}

export const NextInLine: Story = {
  args: {
    state: '予約中',
    rank: 1,
    totalReservations: 5,
    bookTitle: '統計思考の教室',
    today: TODAY,
  },
}

export const OnHold: Story = {
  args: {
    state: '取置き中',
    holdDeadline: '2026-05-13',
    bookTitle: '瀬戸内の民具と暮らし',
    today: TODAY,
  },
}

export const Completed: Story = {
  args: {
    state: '貸出済み',
    bookTitle: '光と影の建築史',
    today: TODAY,
  },
}

export const Cancelled: Story = {
  args: {
    state: 'キャンセル',
    bookTitle: '海辺の郵便局',
    today: TODAY,
  },
}
