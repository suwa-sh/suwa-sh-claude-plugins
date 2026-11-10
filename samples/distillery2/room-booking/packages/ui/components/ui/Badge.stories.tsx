import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'UI/Badge',
  component: Badge,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { children: '予約済み' },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const AllVariants: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>既定</Badge>
      <Badge variant="success">成功</Badge>
      <Badge variant="warning">注意</Badge>
      <Badge variant="destructive">エラー</Badge>
      <Badge variant="info">情報</Badge>
      <Badge variant="neutral">中立</Badge>
      <Badge variant="outline">枠線</Badge>
    </div>
  ),
};
