import React from 'react'
import { Icon } from './Icon'
import { Logo } from './Logo'

export interface NavItem {
  id: string
  label: string
  icon: string
  /** RDRA 業務名（トレーサビリティ用） */
  business?: string
}

export interface PortalShellProps {
  portal: 'patron' | 'staff'
  portalName: string
  userLabel: string
  nav: NavItem[]
  activeId: string
  onNavigate?: (id: string) => void
  /** md 相当。サイドバーをアイコンのみに折りたたむ */
  collapsed?: boolean
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  children?: React.ReactNode
}

/**
 * 両ポータル共通のレイアウト骨格。
 * サイドバー幅 16rem は _inference.md 5-1（ナビ項目 9 / 最大ラベル全角 8 文字）から導出した値。
 */
export const PortalShell: React.FC<PortalShellProps> = ({
  portal,
  portalName,
  userLabel,
  nav,
  activeId,
  onNavigate,
  collapsed = false,
  title,
  description,
  actions,
  children,
}) => (
  <div
    data-portal={portal}
    className="flex"
    style={{
      minHeight: '32rem',
      background: 'var(--background)',
      color: 'var(--foreground)',
      fontFamily: 'var(--font-family-sans)',
    }}
  >
    <aside
      aria-label={`${portalName} ナビゲーション`}
      className="flex flex-col shrink-0"
      style={{
        width: collapsed ? 'var(--sidebar-collapsed-width)' : 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        borderRight: '1px solid var(--sidebar-border)',
        padding: 'var(--spacing-3)',
        gap: 'var(--spacing-4)',
      }}
    >
      <div
        className="flex items-center"
        style={{ gap: 'var(--spacing-2)', padding: 'var(--spacing-2)', minWidth: 0 }}
      >
        <Logo variant={collapsed ? 'icon' : portal === 'staff' ? 'icon' : 'full'} height={collapsed ? 24 : 28} />
        {!collapsed && (
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--foreground-muted)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {portalName}
            </span>
          </span>
        )}
      </div>

      <nav className="flex flex-col" style={{ gap: 'var(--spacing-1)' }}>
        {nav.map((n) => {
          const active = n.id === activeId
          return (
            <button
              key={n.id}
              type="button"
              onClick={() => onNavigate?.(n.id)}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              title={collapsed ? n.label : undefined}
              className="ds-nav-item flex items-center transition-colors"
              style={{
                gap: 'var(--spacing-2)',
                height: 'var(--sidebar-item-height)',
                padding: '0 var(--spacing-3)',
                borderRadius: 'var(--radius-lg)',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                fontSize: 'var(--font-size-sm)',
                fontWeight: active ? 600 : 500,
                background: active ? 'var(--sidebar-item-active-bg)' : 'transparent',
                color: active ? 'var(--sidebar-item-active-foreground)' : 'var(--sidebar-foreground)',
                justifyContent: collapsed ? 'center' : 'flex-start',
                transitionDuration: 'var(--duration-fast)',
                minWidth: 0,
              }}
            >
              <Icon name={n.icon} size={18} />
              {!collapsed && (
                <span
                  style={{
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    minWidth: 0,
                  }}
                >
                  {n.label}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      <div
        className="flex items-center"
        style={{
          marginTop: 'auto',
          gap: 'var(--spacing-2)',
          padding: 'var(--spacing-2)',
          borderTop: '1px solid var(--sidebar-border)',
          minWidth: 0,
        }}
      >
        <Icon name="user" size={18} />
        {!collapsed && (
          <span
            style={{
              fontSize: 'var(--font-size-xs)',
              color: 'var(--foreground-secondary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {userLabel}
          </span>
        )}
      </div>
    </aside>

    <main
      className="flex flex-col"
      style={{
        flex: 1,
        minWidth: 0,
        padding: 'var(--page-padding)',
        gap: 'var(--section-gap)',
        maxWidth: 'var(--content-max-width)',
      }}
    >
      <header className="flex items-start justify-between" style={{ gap: 'var(--spacing-4)' }}>
        <div style={{ minWidth: 0 }}>
          <h1
            style={{
              fontSize: 'var(--font-size-xl)',
              fontWeight: 700,
              lineHeight: 'var(--line-height-tight)',
              margin: 0,
            }}
          >
            {title}
          </h1>
          {description && (
            <p
              style={{
                fontSize: 'var(--font-size-sm)',
                color: 'var(--foreground-secondary)',
                marginTop: 'var(--spacing-1)',
              }}
            >
              {description}
            </p>
          )}
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </header>
      <div className="flex flex-col" style={{ gap: 'var(--section-gap)', minWidth: 0 }}>
        {children}
      </div>
    </main>
  </div>
)

/** RDRA 業務（7 件）+ 共通メニュー 2 件 = ナビ項目 9 */
export const staffNav: NavItem[] = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'collection', label: '蔵書管理業務', icon: 'book', business: '蔵書管理業務' },
  { id: 'use', label: '蔵書利用業務', icon: 'book-open', business: '蔵書利用業務' },
  { id: 'user', label: '利用者管理業務', icon: 'users', business: '利用者管理業務' },
  { id: 'reservation', label: '予約管理業務', icon: 'bookmark', business: '予約管理業務' },
  { id: 'duedate', label: '貸出期限管理業務', icon: 'calendar-clock', business: '貸出期限管理業務' },
  { id: 'analysis', label: '蔵書分析業務', icon: 'chart-bar', business: '蔵書分析業務' },
  { id: 'inquiry', label: '利用照会業務', icon: 'search', business: '利用照会業務' },
  { id: 'settings', label: '設定', icon: 'settings' },
]

export const patronNav: NavItem[] = [
  { id: 'home', label: 'ホーム', icon: 'home' },
  { id: 'search', label: '蔵書をさがす', icon: 'search', business: '蔵書利用業務' },
  { id: 'loans', label: '借りている本', icon: 'book-open', business: '利用照会業務' },
  { id: 'reservations', label: '予約状況', icon: 'bookmark', business: '予約管理業務' },
  { id: 'duedate', label: '返却期限', icon: 'calendar-clock', business: '貸出期限管理業務' },
  { id: 'history', label: '貸出履歴', icon: 'list', business: '利用照会業務' },
  { id: 'mypage', label: '登録内容', icon: 'id-card', business: '利用者管理業務' },
]
