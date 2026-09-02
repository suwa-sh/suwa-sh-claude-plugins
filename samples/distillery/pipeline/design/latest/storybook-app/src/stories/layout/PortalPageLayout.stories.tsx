import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalPageLayout } from '@/components/common/PortalPageLayout'
import { Card, CardHeader } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'

const meta: Meta<typeof PortalPageLayout> = {
  title: 'Common/PortalPageLayout',
  component: PortalPageLayout,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          '全 41 UC が使う共通レイアウトシェル。PortalShell + Icon の合成。ポータル差分（アクセント色・ナビ・ロゴ種別）を portal prop で解決し、画面側にポータル色やナビ定義を書かせない。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof PortalPageLayout>

const Body = () => (
  <Card>
    <CardHeader title="コンテンツ領域" description="各画面のコンポーネントをここに配置する" />
    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
      PortalPageLayout の children スロットです。
    </p>
  </Card>
)

export const PatronContained: Story = {
  args: {
    portal: 'patron',
    title: '蔵書検索',
    activeNavId: 'search',
    breadcrumb: [{ label: '蔵書をさがす' }],
    actions: <Button variant="default" iconLeft="search">検索する</Button>,
    width: 'contained',
    children: <Body />,
  },
}

export const StaffFull: Story = {
  args: {
    portal: 'staff',
    title: '蔵書管理台帳',
    activeNavId: 'collection',
    breadcrumb: [{ label: '蔵書管理業務' }, { label: '蔵書管理台帳' }],
    actions: <Button variant="default" iconLeft="plus">書籍を登録する</Button>,
    width: 'full',
    children: <Body />,
  },
}

export const Collapsed: Story = {
  args: {
    portal: 'staff',
    title: '利用者名簿',
    activeNavId: 'user',
    width: 'full',
    collapsed: true,
    children: <Body />,
  },
}
