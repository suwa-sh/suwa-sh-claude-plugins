import type { Meta, StoryObj } from '@storybook/react-vite';
import { BusinessErrorAlert } from './BusinessErrorAlert';
import { errorMessages } from './errorMessages';
import type { ErrorCode } from './types';

const meta = {
  title: 'Domain/BusinessErrorAlert',
  component: BusinessErrorAlert,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { code: 'SLOT_OVERLAPS' },
} satisfies Meta<typeof BusinessErrorAlert>;

export default meta;
type Story = StoryObj<typeof meta>;

export const SlotOverlaps: Story = {};

/** 契約のすべてのエラーのコードと文 */
export const AllCodes: Story = {
  render: () => (
    <div className="flex flex-col gap-3">
      {(Object.keys(errorMessages) as ErrorCode[]).map((code) => (
        <div key={code} className="flex flex-col gap-1">
          <code className="text-xs text-muted-foreground">{code}</code>
          <BusinessErrorAlert code={code} />
        </div>
      ))}
    </div>
  ),
};
