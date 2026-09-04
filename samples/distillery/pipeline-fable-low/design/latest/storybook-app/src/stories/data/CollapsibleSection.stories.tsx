import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { CollapsibleSection } from '@/components/common/CollapsibleSection'
import { NotificationLogTable } from '@/components/domain/LoanTables'
import { sampleNotifications } from '@/components/domain/sampleData'

const meta: Meta<typeof CollapsibleSection> = {
  title: 'Common/CollapsibleSection',
  component: CollapsibleSection,
  tags: ['autodocs'],
}
export default meta
type Story = StoryObj<typeof CollapsibleSection>

export const Closed: Story = {
  render: () => {
    const [open, setOpen] = useState(false)
    return (
      <CollapsibleSection title="通知記録" open={open} onToggle={setOpen} count={sampleNotifications.length}>
        <NotificationLogTable logs={sampleNotifications} />
      </CollapsibleSection>
    )
  },
}

export const Open: Story = {
  render: () => {
    const [open, setOpen] = useState(true)
    return (
      <CollapsibleSection title="通知記録" open={open} onToggle={setOpen} count={sampleNotifications.length}>
        <NotificationLogTable logs={sampleNotifications} />
      </CollapsibleSection>
    )
  },
}
