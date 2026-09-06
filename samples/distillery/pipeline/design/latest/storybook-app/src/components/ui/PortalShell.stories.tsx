import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalShell } from './PortalShell'
import { Card, CardHeader } from './Card'

const meta: Meta<typeof PortalShell> = {
  title: 'UI/PortalShell',
  component: PortalShell,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
}
export default meta
type Story = StoryObj<typeof PortalShell>

const Content = () => (
  <Card>
    <CardHeader title="コンテンツ領域" description="page-padding 1.5rem / section-gap 2rem" />
    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>画面本体はここに配置します。</p>
  </Card>
)

export const Patron: Story = {
  render: () => (
    <PortalShell portal="patron" currentPath="/search" title="蔵書検索" userName="山田 花子" height={480}>
      <Content />
    </PortalShell>
  ),
}
export const Staff: Story = {
  render: () => (
    <PortalShell portal="staff" currentPath="/staff/books" title="蔵書一覧" userName="司書 田中" height={560}>
      <Content />
    </PortalShell>
  ),
}
export const StaffCollapsed: Story = {
  render: () => (
    <PortalShell portal="staff" currentPath="/staff/loans/new" title="貸出受付" userName="司書 田中" collapsed height={560}>
      <Content />
    </PortalShell>
  ),
}
