import React, { useState } from 'react'
import { Icon, type IconName } from './Icon'
import { Logo } from './Logo'
import { Button } from './Button'

export interface NavItem {
  label: string
  icon: IconName
  href: string
  children?: { label: string; href: string }[]
}

/** 司書ポータル: 業務 5 + ホーム。RDRA の BUC.tsv 業務列と 1:1 */
export const staffNav: NavItem[] = [
  { label: 'ホーム', icon: 'home', href: '/staff' },
  {
    label: '蔵書管理',
    icon: 'book',
    href: '/staff/books',
    children: [
      { label: '蔵書一覧', href: '/staff/books' },
      { label: '書籍登録', href: '/staff/books/new' },
      { label: '窓口蔵書検索', href: '/staff/search' },
    ],
  },
  {
    label: '利用者管理',
    icon: 'users',
    href: '/staff/users',
    children: [
      { label: '利用者一覧', href: '/staff/users' },
      { label: '利用者登録', href: '/staff/users/new' },
      { label: '窓口利用状況照会', href: '/staff/users/status' },
    ],
  },
  {
    label: '貸出・返却',
    icon: 'book-open',
    href: '/staff/loans/new',
    children: [
      { label: '貸出受付', href: '/staff/loans/new' },
      { label: '返却受付', href: '/staff/returns/new' },
      { label: '書籍別予約状況', href: '/staff/books/reservations' },
    ],
  },
  { label: '期限管理', icon: 'calendar-clock', href: '/staff/overdues', children: [{ label: '延滞・督促状況', href: '/staff/overdues' }] },
  {
    label: '運営分析',
    icon: 'chart-bar',
    href: '/staff/reports/inventory',
    children: [
      { label: '在庫状況一覧', href: '/staff/reports/inventory' },
      { label: '人気書籍ランキング', href: '/staff/reports/ranking' },
      { label: '期間別貸出統計', href: '/staff/reports/loans' },
    ],
  },
]

/** 利用者ポータル: 管理導線を一切含めない（NFR E.5.3.1 / SP-003） */
export const patronNav: NavItem[] = [
  { label: '蔵書検索', icon: 'search', href: '/search' },
  { label: 'マイ貸出履歴', icon: 'book-open', href: '/me/loans' },
  { label: 'マイ予約状況', icon: 'bookmark', href: '/me/reservations' },
]

export interface PortalShellProps {
  portal: 'patron' | 'staff'
  currentPath?: string
  title?: string
  userName?: string
  collapsed?: boolean
  children: React.ReactNode
  /** Storybook 用: 画面全体ではなく枠内に収める */
  height?: string | number
}

const NavLink: React.FC<{ href: string; active: boolean; children: React.ReactNode; sub?: boolean; collapsed?: boolean; label?: string }> = ({ href, active, children, sub, collapsed, label }) => (
  <a
    href={href}
    aria-current={active ? 'page' : undefined}
    title={collapsed ? label : undefined}
    className="flex items-center transition-colors hover:bg-hover-muted"
    style={{
      gap: 'var(--spacing-3)',
      height: sub ? '2rem' : 'var(--sidebar-item-height)',
      paddingInline: collapsed ? 0 : sub ? 'var(--spacing-10)' : 'var(--spacing-3)',
      justifyContent: collapsed ? 'center' : undefined,
      borderRadius: 'var(--radius-lg)',
      background: active ? 'var(--sidebar-active-bg)' : 'transparent',
      color: active ? 'var(--sidebar-active-fg)' : 'var(--foreground-secondary)',
      fontWeight: active ? 600 : 500,
      fontSize: sub ? 'var(--font-size-xs)' : 'var(--font-size-sm)',
      textDecoration: 'none',
    }}
  >
    {children}
  </a>
)

export const PortalShell: React.FC<PortalShellProps> = ({ portal, currentPath = '', title, userName = '利用者', collapsed: initialCollapsed = false, children, height = '100%' }) => {
  const [collapsed, setCollapsed] = useState(initialCollapsed)
  const [menuOpen, setMenuOpen] = useState(false)

  if (portal === 'patron') {
    return (
      <div data-portal="patron" className="flex flex-col" style={{ minHeight: height, background: 'var(--background)', color: 'var(--foreground)' }}>
        <header className="flex items-center justify-between border-b" style={{ height: 'var(--topnav-height)', paddingInline: 'var(--page-padding)', background: 'var(--card-bg)', borderColor: 'var(--border)', gap: 'var(--spacing-4)' }}>
          <div className="flex items-center" style={{ gap: 'var(--spacing-6)' }}>
            <Logo height={28} />
            <nav aria-label="メイン" className="hidden items-center md:flex" style={{ gap: 'var(--spacing-1)' }}>
              {patronNav.map((n) => (
                <NavLink key={n.href} href={n.href} active={currentPath.startsWith(n.href)}>
                  <Icon name={n.icon} size={16} />
                  {n.label}
                </NavLink>
              ))}
            </nav>
          </div>
          <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
            <span className="hidden sm:inline" style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>
              {userName} さん
            </span>
            <Button variant="ghost" size="sm" icon="log-out">
              ログアウト
            </Button>
            <button type="button" className="cursor-pointer md:hidden" aria-label="メニュー" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} style={{ padding: 'var(--spacing-2)' }}>
              <Icon name={menuOpen ? 'x' : 'menu'} size={20} />
            </button>
          </div>
        </header>
        {menuOpen ? (
          <nav aria-label="メイン（モバイル）" className="flex flex-col border-b md:hidden" style={{ padding: 'var(--spacing-2)', borderColor: 'var(--border)' }}>
            {patronNav.map((n) => (
              <NavLink key={n.href} href={n.href} active={currentPath.startsWith(n.href)}>
                <Icon name={n.icon} size={16} />
                {n.label}
              </NavLink>
            ))}
          </nav>
        ) : null}
        <main className="mx-auto w-full flex-1" style={{ maxWidth: 'var(--content-max-width)', padding: 'var(--page-padding)' }}>
          {title ? (
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--section-gap)' }}>{title}</h1>
          ) : null}
          {children}
        </main>
      </div>
    )
  }

  return (
    <div data-portal="staff" className="flex" style={{ minHeight: height, background: 'var(--background)', color: 'var(--foreground)' }}>
      <aside
        className="flex shrink-0 flex-col border-r"
        style={{ width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)', background: 'var(--sidebar-bg)', borderColor: 'var(--border)', transition: 'width var(--duration-normal)' }}
      >
        <div className="flex items-center border-b" style={{ height: 'var(--topnav-height)', paddingInline: collapsed ? 0 : 'var(--spacing-4)', justifyContent: collapsed ? 'center' : 'space-between', borderColor: 'var(--border)' }}>
          {collapsed ? <Logo variant="icon" height={28} /> : <Logo height={26} />}
          {!collapsed ? (
            <button type="button" className="cursor-pointer hover:bg-hover-muted" aria-label="サイドバーを折りたたむ" onClick={() => setCollapsed(true)} style={{ padding: 'var(--spacing-1)', borderRadius: 'var(--radius-md)', color: 'var(--foreground-muted)' }}>
              <Icon name="chevron-left" size={18} />
            </button>
          ) : null}
        </div>
        <nav aria-label="メイン" className="flex flex-1 flex-col overflow-y-auto" style={{ padding: 'var(--spacing-2)', gap: 'var(--spacing-1)' }}>
          {staffNav.map((n) => {
            const active = n.href === '/staff' ? currentPath === '/staff' : n.children ? n.children.some((c) => currentPath === c.href) || currentPath.startsWith(n.href) : currentPath.startsWith(n.href)
            return (
              <div key={n.href} className="flex flex-col" style={{ gap: 2 }}>
                <NavLink href={n.href} active={active && (collapsed || !n.children)} collapsed={collapsed} label={n.label}>
                  <Icon name={n.icon} size={18} />
                  {!collapsed ? n.label : null}
                </NavLink>
                {!collapsed && n.children && active
                  ? n.children.map((c) => (
                      <NavLink key={c.href} href={c.href} active={currentPath === c.href} sub>
                        {c.label}
                      </NavLink>
                    ))
                  : null}
              </div>
            )
          })}
        </nav>
        {collapsed ? (
          <button type="button" className="cursor-pointer border-t hover:bg-hover-muted" aria-label="サイドバーを展開" onClick={() => setCollapsed(false)} style={{ height: 'var(--sidebar-item-height)', borderColor: 'var(--border)', color: 'var(--foreground-muted)' }}>
            <Icon name="chevron-right" size={18} />
          </button>
        ) : null}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between border-b" style={{ height: 'var(--topnav-height)', paddingInline: 'var(--page-padding)', background: 'var(--card-bg)', borderColor: 'var(--border)' }}>
          <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--foreground-secondary)' }}>司書ポータル（館内ネットワーク限定）</p>
          <div className="flex items-center" style={{ gap: 'var(--spacing-2)' }}>
            <span className="inline-flex items-center" style={{ gap: 'var(--spacing-1)', fontSize: 'var(--font-size-sm)' }}>
              <Icon name="shield-check" size={16} />
              {userName}
            </span>
            <Button variant="ghost" size="sm" icon="log-out">
              ログアウト
            </Button>
          </div>
        </header>
        <main className="flex-1" style={{ padding: 'var(--page-padding)' }}>
          {title ? (
            <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, marginBottom: 'var(--section-gap)' }}>{title}</h1>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  )
}
