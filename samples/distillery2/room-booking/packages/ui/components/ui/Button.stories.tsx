import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'UI/Button',
  component: Button,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: '予約する' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Outline: Story = { args: { variant: 'outline', children: '戻る' } };
export const Ghost: Story = { args: { variant: 'ghost', children: '閉じる' } };
export const Destructive: Story = { args: { variant: 'destructive', children: '予約を取り消す' } };
export const Loading: Story = { args: { loading: true, children: '予約しています' } };
export const Sizes: Story = {
  render: () => (
    <div className="flex items-center gap-3">
      <Button size="sm">小</Button>
      <Button size="md">中</Button>
      <Button size="lg">大</Button>
    </div>
  ),
};
