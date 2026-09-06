import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ReportKpiCard } from './ReportKpiCard'

const meta = {
  title: 'Domain/ReportKpiCard',
  component: ReportKpiCard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReportKpiCard>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: { label: '蔵書総数', value: 128450, unit: '冊', icon: 'library' },
}

export const WithDelta: Story = {
  args: {
    label: '当月貸出件数',
    value: 3820,
    unit: '件',
    icon: 'book-open',
    delta: { value: 12, label: '前期比' },
    tone: 'success',
  },
}

export const Negative: Story = {
  args: {
    label: '延滞件数',
    value: 74,
    unit: '件',
    icon: 'alert-triangle',
    delta: { value: -18, label: '前期比' },
    tone: 'destructive',
  },
}

export const Row: Story = {
  args: { label: '蔵書総数', value: 128450, unit: '冊', icon: 'library' },
  render: () => (
    <div className="grid grid-cols-3" style={{ gap: 'var(--component-gap)' }}>
      <ReportKpiCard label="蔵書総数" value={128450} unit="冊" icon="library" />
      <ReportKpiCard
        label="当月貸出件数"
        value={3820}
        unit="件"
        icon="book-open"
        delta={{ value: 12, label: '前期比' }}
        tone="success"
      />
      <ReportKpiCard
        label="延滞件数"
        value={74}
        unit="件"
        icon="alert-triangle"
        delta={{ value: -18, label: '前期比' }}
        tone="destructive"
      />
    </div>
  ),
}
