import type { Meta, StoryObj } from '@storybook/react-vite';
import { Select } from './Select';

const meta = {
  title: 'UI/Select',
  component: Select,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    label: '会議室',
    placeholder: '選択',
    options: [
      { value: 'room-a', label: '会議室 A' },
      { value: 'room-b', label: '会議室 B' },
      { value: 'room-c', label: '会議室 C' },
    ],
    defaultValue: 'room-a',
  },
} satisfies Meta<typeof Select>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithError: Story = { args: { error: '選び直してください' } };
