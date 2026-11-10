import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvailabilityBadge } from './AvailabilityBadge';

const meta = {
  title: 'Domain/AvailabilityBadge',
  component: AvailabilityBadge,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { availability: 'available' },
} satisfies Meta<typeof AvailabilityBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Available: Story = {};
export const Reserved: Story = { args: { availability: 'reserved' } };
