import type { Meta, StoryObj } from '@storybook/react-vite';
import { ReservationSummary } from './ReservationSummary';

const meta = {
  title: 'Domain/ReservationSummary',
  component: ReservationSummary,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { roomName: '会議室A', date: '2026-11-05', startTime: '10:00', endTime: '11:00' },
} satisfies Meta<typeof ReservationSummary>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithStatus: Story = { args: { status: 'reserved' } };
