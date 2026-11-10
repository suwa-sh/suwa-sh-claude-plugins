import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';

const meta = {
  title: 'UI/Card',
  component: Card,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    title: '予約の内容',
    description: '時刻は 30 分刻みで選びます。',
    children: <p className="text-sm">カードの本文です。</p>,
  },
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Hoverable: Story = { args: { hoverable: true } };
