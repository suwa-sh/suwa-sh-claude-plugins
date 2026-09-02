import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { ReportPeriodSelector } from './ReportPeriodSelector'
import type { ReportPeriodValue } from './ReportPeriodSelector'

const meta = {
  title: 'Domain/ReportPeriodSelector',
  component: ReportPeriodSelector,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof ReportPeriodSelector>

export default meta
type Story = StoryObj<typeof meta>

const initial: ReportPeriodValue = {
  reportType: '期間別貸出統計',
  period: '月次',
  from: '2026-04-01',
  to: '2026-09-30',
}

const Wrapper: React.FC<{ submitting?: boolean }> = ({ submitting = false }) => {
  const [value, setValue] = React.useState<ReportPeriodValue>(initial)
  return (
    <ReportPeriodSelector
      value={value}
      onChange={setValue}
      onSubmit={() => undefined}
      submitting={submitting}
    />
  )
}

export const Default: Story = {
  args: { value: initial, onChange: () => undefined, onSubmit: () => undefined },
  render: () => <Wrapper />,
}

export const Submitting: Story = {
  args: {
    value: initial,
    onChange: () => undefined,
    onSubmit: () => undefined,
    submitting: true,
  },
  render: () => <Wrapper submitting />,
}
