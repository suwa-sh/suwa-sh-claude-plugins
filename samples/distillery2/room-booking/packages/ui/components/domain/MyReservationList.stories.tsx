import type { Meta, StoryObj } from '@storybook/react-vite';
import { sampleMyReservations } from '../../stories/sampleData';
import { MyReservationList } from './MyReservationList';

const meta = {
  title: 'Domain/MyReservationList',
  component: MyReservationList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { reservations: sampleMyReservations },
} satisfies Meta<typeof MyReservationList>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Empty: Story = { args: { reservations: [] } };
export const Loading: Story = { args: { loading: true } };
