import type { Meta, StoryObj } from '@storybook/react-vite';
import { sampleRooms } from '../../stories/sampleData';
import { ReservationForm } from './ReservationForm';

const meta = {
  title: 'Domain/ReservationForm',
  component: ReservationForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    rooms: sampleRooms,
    value: { roomId: 'room-1', date: '2026-11-05', startTime: '10:00', endTime: '11:00' },
  },
} satisfies Meta<typeof ReservationForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Submitting: Story = { args: { submitting: true } };
export const Rejected: Story = { args: { errorCode: 'SLOT_OVERLAPS' } };
