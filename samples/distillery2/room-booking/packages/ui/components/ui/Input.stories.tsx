import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from './Input';

const meta = {
  title: 'UI/Input',
  component: Input,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { label: '日付', type: 'date', defaultValue: '2026-11-05' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: '今日以降の日付を選びます' } };
export const WithError: Story = { args: { error: '日付を指定してください', defaultValue: '' } };
export const Disabled: Story = { args: { disabled: true } };
