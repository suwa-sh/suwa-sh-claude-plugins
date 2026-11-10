import type { Meta, StoryObj } from '@storybook/react-vite';
import { AppShell } from './AppShell';

const meta = {
  title: 'Layout/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  args: {
    current: 'availability',
    userName: '山田 花子',
    title: '会議室の空き状況',
    description: '画面の説明',
    children: <p className="text-sm">本文</p>,
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const MyReservationsActive: Story = {
  args: { current: 'my-reservations', title: '自分の予約' },
};
