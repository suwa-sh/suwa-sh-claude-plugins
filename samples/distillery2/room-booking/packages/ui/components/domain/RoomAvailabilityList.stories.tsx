import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { sampleAvailability } from '../../stories/sampleData';
import { RoomAvailabilityList } from './RoomAvailabilityList';

const meta = {
  title: 'Domain/RoomAvailabilityList',
  component: RoomAvailabilityList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { rooms: sampleAvailability, slotLabel: '2026-11-05 10:00〜11:00' },
} satisfies Meta<typeof RoomAvailabilityList>;

export default meta;
type Story = StoryObj<typeof meta>;

/** 予約の操作を渡さない一覧 (空きか予約済みかだけを示し、「予約する」は出さない) */
export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const AllReserved: Story = {
  args: { rooms: sampleAvailability.map((r) => ({ ...r, availability: 'reserved' as const })) },
};

/** 予約の操作を渡したとき (空きの行に「予約する」を出す) */
export const WithReserve: Story = { args: { onReserve: fn() } };

/** 予約の操作を渡したときの照会中 */
export const WithReserveLoading: Story = { args: { onReserve: fn(), loading: true } };
