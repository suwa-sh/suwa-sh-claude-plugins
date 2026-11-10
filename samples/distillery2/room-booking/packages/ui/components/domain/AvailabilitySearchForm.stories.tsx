import type { Meta, StoryObj } from '@storybook/react-vite';
import { AvailabilitySearchForm } from './AvailabilitySearchForm';

const meta = {
  title: 'Domain/AvailabilitySearchForm',
  component: AvailabilitySearchForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { value: { date: '2026-11-05', startTime: '10:00', endTime: '11:00' } },
} satisfies Meta<typeof AvailabilitySearchForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Searching: Story = { args: { searching: true } };
export const WithError: Story = {
  args: {
    value: { date: '2026-11-05', startTime: '11:00', endTime: '10:00' },
    errorCode: 'INVALID_TIME_RANGE',
  },
};
