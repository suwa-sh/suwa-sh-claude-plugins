import type { Meta, StoryObj } from '@storybook/react-vite';
import { sampleMyReservations } from '../../stories/sampleData';
import { CancelConfirmPanel } from './CancelConfirmPanel';

const meta = {
  title: 'Domain/CancelConfirmPanel',
  component: CancelConfirmPanel,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { reservation: sampleMyReservations[0] },
} satisfies Meta<typeof CancelConfirmPanel>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Submitting: Story = { args: { submitting: true } };
export const Rejected: Story = { args: { errorCode: 'CANCEL_DEADLINE_PASSED' } };
