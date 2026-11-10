import type { Meta, StoryObj } from '@storybook/react-vite';
import { Icon, type IconName } from './Icon';

const names: IconName[] = [
  'search',
  'calendar',
  'clock',
  'user',
  'door',
  'check-circle',
  'x-circle',
  'alert-circle',
];

const meta = {
  title: 'UI/Icon',
  component: Icon,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { name: 'calendar', size: 24 },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const All: Story = {
  render: () => (
    <div className="flex flex-wrap gap-6">
      {names.map((n) => (
        <div key={n} className="flex flex-col items-center gap-1 text-xs text-muted-foreground">
          <Icon name={n} size={24} className="text-foreground" />
          {n}
        </div>
      ))}
    </div>
  ),
};
