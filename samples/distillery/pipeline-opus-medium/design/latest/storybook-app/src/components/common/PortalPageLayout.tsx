import React from 'react'
import { Icon } from '@/components/ui/Icon'
import { PortalShell, staffNav, patronNav, type NavItem } from '@/components/ui/PortalShell'

export interface Breadcrumb {
  label: string
  href?: string
}

export interface PortalPageLayoutProps {
  portal: 'patron' | 'staff'
  /** 現在の業務名。ヘッダーと <h1> に使う */
  title: string
  /** ページの補足説明 */
  description?: React.ReactNode
  /** 一覧 → 詳細 → 操作の 3 段構成の現在位置 */
  breadcrumb?: Breadcrumb[]
  /** 画面主操作（Button）を右上に配置する */
  actions?: React.ReactNode
  /** 既定 contained（80rem 中央寄せ）。一覧・レポートは full */
  width?: 'contained' | 'full'
  /** サイドバーのアクティブ項目。省略時は portal の先頭業務項目 */
  activeNavId?: string
  /** md（768–1023px）相当の折りたたみ表示。既定は展開 */
  collapsed?: boolean
  /** サイドバー項目のクリック。ルーティングは AppShell が注入する */
  onNavigate?: (navId: string) => void
  children: React.ReactNode
}

const portalMeta: Record<
  'patron' | 'staff',
  { portalName: string; userLabel: string; nav: NavItem[] }
> = {
  patron: { portalName: '利用者ポータル', userLabel: '利用者: 山田 花子（U-000123）', nav: patronNav },
  staff: { portalName: '司書ポータル', userLabel: '司書: 佐藤 太郎（館内ネットワーク）', nav: staffNav },
}

/**
 * 全 41 UC が同一の骨格（ヘッダー固定 + サイドバー16rem + コンテンツ）を使うための唯一の入口。
 * ポータル差分（アクセント色・ナビ項目・ロゴ種別）は PortalShell 側で `data-portal` から解決する。
 * 画面側でポータル色やナビ定義を書かせない。
 */
export const PortalPageLayout: React.FC<PortalPageLayoutProps> = ({
  portal,
  title,
  description,
  breadcrumb,
  actions,
  width = 'contained',
  activeNavId,
  collapsed = false,
  onNavigate,
  children,
}) => {
  const meta = portalMeta[portal]
  const activeId = activeNavId ?? meta.nav[1]?.id ?? meta.nav[0].id

  return (
    <div className="flex flex-col" style={{ minHeight: '32rem' }}>
      <a
        href="#main-content"
        className="ds-skip-link"
        style={{
          position: 'absolute',
          left: '-9999px',
          top: 0,
          zIndex: 100,
          background: 'var(--primary)',
          color: 'var(--primary-foreground)',
          padding: 'var(--spacing-2) var(--spacing-4)',
          borderRadius: 'var(--radius-md)',
        }}
      >
        本文へスキップ
      </a>
      <PortalShell
        portal={portal}
        portalName={meta.portalName}
        userLabel={meta.userLabel}
        nav={meta.nav}
        activeId={activeId}
        collapsed={collapsed}
        onNavigate={onNavigate}
        title={title}
        description={description}
        actions={actions}
      >
        <div
          id="main-content"
          style={{
            maxWidth: width === 'contained' ? 'var(--content-max-width)' : 'none',
            width: '100%',
            margin: width === 'contained' ? '0 auto' : undefined,
          }}
        >
          {breadcrumb && breadcrumb.length > 0 && (
            <nav
              aria-label="パンくずリスト"
              className="flex items-center flex-wrap"
              style={{
                gap: 'var(--spacing-1)',
                marginBottom: 'var(--component-gap)',
                fontSize: 'var(--font-size-xs)',
                color: 'var(--foreground-muted)',
              }}
            >
              {breadcrumb.map((b, i) => (
                <span key={`${b.label}-${i}`} className="flex items-center" style={{ gap: 'var(--spacing-1)' }}>
                  {i > 0 && <Icon name="chevron-right" size={12} />}
                  {b.href && i < breadcrumb.length - 1 ? (
                    <a href={b.href} style={{ color: 'var(--foreground-secondary)' }}>
                      {b.label}
                    </a>
                  ) : (
                    <span
                      aria-current={i === breadcrumb.length - 1 ? 'page' : undefined}
                      style={{ color: i === breadcrumb.length - 1 ? 'var(--foreground)' : undefined }}
                    >
                      {b.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          )}
          {children}
        </div>
      </PortalShell>
      <footer
        style={{
          borderTop: '1px solid var(--border)',
          padding: 'var(--spacing-3) var(--page-padding)',
          fontSize: 'var(--font-size-xs)',
          color: 'var(--foreground-muted)',
          display: 'flex',
          justifyContent: 'space-between',
          gap: 'var(--spacing-4)',
          flexWrap: 'wrap',
        }}
      >
        <span>&copy; Libra 図書館蔵書管理システム</span>
        <a href="#" style={{ color: 'var(--foreground-secondary)' }}>
          利用案内・お問い合わせ
        </a>
      </footer>
    </div>
  )
}
