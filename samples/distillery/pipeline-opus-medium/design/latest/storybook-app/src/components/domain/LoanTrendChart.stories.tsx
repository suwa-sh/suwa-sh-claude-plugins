import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { LoanTrendChart } from './LoanTrendChart'

const meta = {
  title: 'Domain/LoanTrendChart',
  component: LoanTrendChart,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof LoanTrendChart>

export default meta
type Story = StoryObj<typeof meta>

export const Monthly: Story = {
  args: {
    unit: '件',
    highlightMax: true,
    data: [
      { label: '4月', value: 2840 },
      { label: '5月', value: 3120 },
      { label: '6月', value: 2960 },
      { label: '7月', value: 4180 },
      { label: '8月', value: 3950 },
      { label: '9月', value: 3820 },
    ],
  },
}

export const Daily: Story = {
  args: {
    unit: '件',
    data: [
      { label: '9/1', value: 128 },
      { label: '9/2', value: 96 },
      { label: '9/3', value: 141 },
      { label: '9/4', value: 152 },
      { label: '9/5', value: 187 },
      { label: '9/6', value: 204 },
      { label: '9/7', value: 173 },
    ],
  },
}

export const Empty: Story = {
  args: { data: [] },
}
