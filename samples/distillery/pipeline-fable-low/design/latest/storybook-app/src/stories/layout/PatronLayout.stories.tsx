import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card, CardHeader } from '@/components/ui/Card'
import { PatronLayout } from '@/components/common/PatronLayout'

const meta: Meta<typeof PatronLayout> = {
  title: 'Common/PatronLayout',
  component: PatronLayout,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof PatronLayout>

const Content = () => (
  <Card>
    <CardHeader title="コンテンツ領域" description="PageHeader + 画面本体はここに配置します" />
  </Card>
)

export const Search: Story = {
  render: () => (
    <div style={{ height: 480 }}>
      <PatronLayout activeNav="search" userName="山田 花子">
        <Content />
      </PatronLayout>
    </div>
  ),
}

export const MyReservations: Story = {
  render: () => (
    <div style={{ height: 480 }}>
      <PatronLayout activeNav="myReservations" userName="山田 花子">
        <Content />
      </PatronLayout>
    </div>
  ),
}

export const Unauthenticated: Story = {
  render: () => (
    <div style={{ height: 480 }}>
      <PatronLayout activeNav="myLoans" requireAuth isAuthenticated={false}>
        <Content />
      </PatronLayout>
    </div>
  ),
}
