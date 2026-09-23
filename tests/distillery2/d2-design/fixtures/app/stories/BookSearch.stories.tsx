import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { BookCard } from '../components/domain/BookCard';

const meta = { title: 'Screens/BookSearch', component: BookCard, tags: ['autodocs'] } satisfies Meta<typeof BookCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = { args: { title: '吾輩は猫である' } };
export const Empty: Story = { args: {} };
