import type { Meta, StoryObj } from '@storybook/react-vite';
import { Alert } from './Alert';

const meta = {
  title: 'UI/Alert',
  component: Alert,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { title: '予約しました', children: '自分の予約一覧から取り消せます。', variant: 'success' },
} satisfies Meta<typeof Alert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {};
export const Info: Story = {
  args: { variant: 'info', title: 'お知らせ', children: '時刻は 30 分刻みです。' },
};
export const Warning: Story = {
  args: { variant: 'warning', title: '注意', children: '開始時刻が近づいています。' },
};
export const Destructive: Story = {
  args: {
    variant: 'destructive',
    title: 'この時間帯は既に予約されています',
    children: '別の時間帯を選んでください。',
  },
};
