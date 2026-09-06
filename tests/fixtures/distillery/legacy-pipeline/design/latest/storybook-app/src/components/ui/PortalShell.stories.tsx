import React from 'react'
import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { PortalShell, staffNav, patronNav } from './PortalShell'
import { Card, CardHeader } from './Card'
import { Button } from './Button'
import { Badge } from './Badge'

const meta: Meta<typeof PortalShell> = {
  title: 'UI/PortalShell',
  component: PortalShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'ポータル共通のレイアウト骨格。サイドバー幅 16rem は RDRA の業務 7 件 + 共通メニュー 2 件 = ナビ項目 9、最大ラベル「貸出期限管理業務」全角 8 文字から導出した値（_inference.md 5-1）。`collapsed` は md（768–1023px）相当の折りたたみ表示。',
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof PortalShell>

const Body: React.FC<{ lines: string[] }> = ({ lines }) => (
  <Card>
    <CardHeader title="コンテンツ領域" description="12 カラムグリッドを敷く領域" />
    <div className="flex flex-col" style={{ gap: 'var(--spacing-2)' }}>
      {lines.map((l) => (
        <p key={l} style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
          {l}
        </p>
      ))}
    </div>
  </Card>
)

export const StaffPortal: Story = {
  render: () => {
    const [active, setActive] = React.useState('collection')
    return (
      <PortalShell
        portal="staff"
        portalName="司書ポータル"
        userLabel="司書 / 田中 芳江"
        nav={staffNav}
        activeId={active}
        onNavigate={setActive}
        title="蔵書管理台帳"
        description="蔵書の登録状況を確認する（UC: 蔵書一覧を照会する）"
        actions={
          <>
            <Button variant="outline" size="sm" iconLeft="download">
              CSV 出力
            </Button>
            <Button size="sm" iconLeft="plus">
              書籍を登録
            </Button>
          </>
        }
      >
        <Body
          lines={[
            '館内ネットワーク限定公開（arch SP-005）。窓口業務を最小操作数で完了できる高密度 UI（SP-006）。',
            'プライマリ色はティア色分けのためティール系。利用者ポータルとの取り違えを色で防ぐ。',
          ]}
        />
      </PortalShell>
    )
  },
}

export const PatronPortal: Story = {
  render: () => {
    const [active, setActive] = React.useState('loans')
    return (
      <PortalShell
        portal="patron"
        portalName="利用者ポータル"
        userLabel="利用者 / U-2026-0184"
        nav={patronNav}
        activeId={active}
        onNavigate={setActive}
        title="借りている本"
        description="貸出内容と返却期限を確認する（UC: 自分の現在の貸出を照会する）"
        actions={<Badge variant="info" icon="book-open">貸出中 3 冊</Badge>}
      >
        <Body
          lines={[
            'インターネット公開。本人限定参照の UI 制約（arch SP-004）により、他利用者のデータへ到達する導線を持たない。',
            'PC / タブレットをフル設計、スマートフォンは簡易対応（NFR F.1.1.3 Lv2）。',
          ]}
        />
      </PortalShell>
    )
  },
}

export const CollapsedSidebar: Story = {
  render: () => (
    <PortalShell
      portal="staff"
      portalName="司書ポータル"
      userLabel="司書 / 田中 芳江"
      nav={staffNav}
      activeId="duedate"
      collapsed
      title="返却期限接近貸出一覧"
      description="md（768–1023px）ではサイドバーを 4rem に折りたたむ"
    >
      <Body lines={['タブレット横持ち相当の表示。ラベルは title 属性で補完する。']} />
    </PortalShell>
  ),
}
