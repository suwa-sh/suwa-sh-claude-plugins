import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { AppShell, AppShellByPath } from '@/components/common/AppShell'
import { Card } from '@/components/ui/Card'
import { appRoutes, buildPath } from '@/components/common/routes'

const meta: Meta<typeof AppShell> = {
  title: 'Shell/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: [
          'アプリのエントリポイント兼シェル。ルート id を渡すと、ルート表からポータル・画面名・',
          'サイドバーのアクティブ項目を解決して画面骨格を描画する。',
          '',
          '**所有権**',
          '',
          '| 対象 | 所有者 | 備考 |',
          '|------|--------|------|',
          '| ルート表 `routes.ts` | デザインシステム | `screens[].route` と 1:1。実装側で追記しない |',
          '| エントリポイント `AppShell` / `AppShellByPath` | デザインシステム | ポータル解決・404・ポータル外アクセスの判定 |',
          '| 遷移 API `useAppNavigation` | デザインシステム | 遷移はルート id 指定のみ。URL 直書き禁止 |',
          '| router アダプタ | 実装リポ | `onNavigate` に `router.push` を注入する |',
          '| 各ページ本体 | 実装リポ | `AppShell` の children として描画する |',
          '',
          'ルートの追加は design ステージの責務（RDRA の BUC / 画面に無いルートは作らない）。',
        ].join('\n'),
      },
    },
  },
}
export default meta
type Story = StoryObj<typeof AppShell>

const Body = () => (
  <Card>
    <p style={{ color: 'var(--foreground-secondary)' }}>
      ここに各ルート id に対応するページ本体（実装リポの所有物）が入る。
    </p>
  </Card>
)

export const PatronRoute: Story = {
  name: '利用者ポータル（ルート id 指定）',
  args: {
    routeId: 'patron-loan-list',
    children: <Body />,
  },
}

export const StaffRouteWithParams: Story = {
  name: '司書ポータル（パスパラメータあり）',
  args: {
    routeId: 'staff-book-edit',
    params: { bookId: 'B-000123' },
    breadcrumb: [{ label: '蔵書管理台帳' }, { label: '書誌情報訂正' }],
    children: <Body />,
  },
}

export const ResolvedFromUrl: Story = {
  name: 'URL から解決する（router アダプタ用）',
  render: () => (
    <AppShellByPath pathname="/staff/returns/L-000045/restock">
      <Body />
    </AppShellByPath>
  ),
}

export const NotFound: Story = {
  name: '未登録 URL',
  render: () => (
    <div style={{ padding: 'var(--page-padding)' }}>
      <AppShellByPath pathname="/staff/unknown-screen">
        <Body />
      </AppShellByPath>
    </div>
  ),
}

export const PortalMismatch: Story = {
  name: 'ポータル外アクセス',
  render: () => (
    <div style={{ padding: 'var(--page-padding)' }}>
      <AppShellByPath pathname={buildPath('staff-book-list')} portal="patron">
        <Body />
      </AppShellByPath>
    </div>
  ),
}

export const RouteRegistry: Story = {
  name: 'ルート表（41 画面）',
  parameters: { layout: 'padded' },
  render: () => (
    <table style={{ width: '100%', fontSize: 'var(--font-size-sm)', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ background: 'var(--table-header-bg)', color: 'var(--table-header-foreground)' }}>
          <th style={{ textAlign: 'left', padding: 'var(--spacing-2)' }}>route id</th>
          <th style={{ textAlign: 'left', padding: 'var(--spacing-2)' }}>path</th>
          <th style={{ textAlign: 'left', padding: 'var(--spacing-2)' }}>portal</th>
          <th style={{ textAlign: 'left', padding: 'var(--spacing-2)' }}>画面</th>
          <th style={{ textAlign: 'left', padding: 'var(--spacing-2)' }}>UC</th>
        </tr>
      </thead>
      <tbody>
        {appRoutes.map((r) => (
          <tr key={r.id} style={{ borderTop: '1px solid var(--table-border)' }}>
            <td style={{ padding: 'var(--spacing-2)', fontFamily: 'var(--font-family-mono)' }}>{r.id}</td>
            <td style={{ padding: 'var(--spacing-2)', fontFamily: 'var(--font-family-mono)' }}>{r.path}</td>
            <td style={{ padding: 'var(--spacing-2)' }}>{r.portal}</td>
            <td style={{ padding: 'var(--spacing-2)' }}>{r.screen}</td>
            <td style={{ padding: 'var(--spacing-2)' }}>{r.uc}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
}
