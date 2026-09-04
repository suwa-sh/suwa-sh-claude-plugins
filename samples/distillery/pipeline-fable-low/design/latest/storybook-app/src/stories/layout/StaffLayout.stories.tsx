import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { Card, CardHeader } from '@/components/ui/Card'
import { StaffLayout } from '@/components/common/StaffLayout'

const meta: Meta<typeof StaffLayout> = {
  title: 'Common/StaffLayout',
  component: StaffLayout,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof StaffLayout>

const Content = () => (
  <Card>
    <CardHeader title="コンテンツ領域" description="PageHeader + 画面本体はここに配置します" />
  </Card>
)

export const BookList: Story = {
  render: () => (
    <div style={{ height: 560 }}>
      <StaffLayout activeGroup="books" activeItem="bookList" userName="司書 田中">
        <Content />
      </StaffLayout>
    </div>
  ),
}

export const Overdues: Story = {
  render: () => (
    <div style={{ height: 560 }}>
      <StaffLayout activeGroup="reservations" activeItem="overdues" userName="司書 田中">
        <Content />
      </StaffLayout>
    </div>
  ),
}

export const Forbidden: Story = {
  render: () => (
    <div style={{ height: 560 }}>
      <StaffLayout activeGroup="books" activeItem="bookList" isLibrarian={false} userName="利用者 山田">
        <Content />
      </StaffLayout>
    </div>
  ),
}
