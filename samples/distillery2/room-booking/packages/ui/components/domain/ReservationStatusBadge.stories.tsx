import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReservationStatusBadge } from './ReservationStatusBadge';

const meta = {
  title: 'Domain/ReservationStatusBadge',
  component: ReservationStatusBadge,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { status: 'reserved' },
} satisfies Meta<typeof ReservationStatusBadge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Reserved: Story = {};
export const Cancelled: Story = { args: { status: 'cancelled' } };
