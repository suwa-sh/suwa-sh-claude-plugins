import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { TimeSlotPicker } from './TimeSlotPicker';
import { timeFieldErrors } from './timeFieldErrors';
import type { TimeSlotValue } from './types';

const meta = {
  title: 'Domain/TimeSlotPicker',
  component: TimeSlotPicker,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { value: { date: '2026-11-05', startTime: '10:00', endTime: '11:00' } },
} satisfies Meta<typeof TimeSlotPicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: (args) => {
    const [value, setValue] = useState<TimeSlotValue>(args.value);
    return <TimeSlotPicker {...args} value={value} onChange={setValue} />;
  },
};
export const Empty: Story = { args: { value: { date: '', startTime: '', endTime: '' } } };
export const WithError: Story = {
  args: {
    value: { date: '2026-11-05', startTime: '11:00', endTime: '10:00' },
    errors: timeFieldErrors('INVALID_TIME_RANGE'),
  },
};
