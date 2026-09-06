import React from 'react'
import { Alert } from '@/components/ui/Feedback'
import { PortalPageLayout, type Breadcrumb } from '@/components/common/PortalPageLayout'
import {
  appRoutes,
  buildPath,
  getRoute,
  matchPath,
  routesOf,
  type AppRoute,
  type PortalId,
} from '@/components/common/routes'

/**
 * アプリのエントリポイント兼シェル（CR-d0f57ea2-010）。
 *
 * 所有権:
 * - デザインシステム（本ファイル）が所有するもの
 *   - ルート表 `routes.ts`（URL の正本。screens[].route と 1:1）
 *   - ポータル解決・ナビゲーションのアクティブ判定・画面骨格（PortalPageLayout）
 *   - 遷移 API（`useAppNavigation`）。画面は URL 文字列を直接組み立てない
 * - 実装リポが所有するもの
 *   - 各ルート id に対応するページ本体
 *   - router アダプタ（Next.js App Router 等の実 URL への接続）。
 *     `onNavigate` に `router.push` を注入するだけでよい
 *   - 認証済みユーザーの取得と `user` への注入
 *
 * ルートを増やすことは design ステージの責務であり、実装側で routes.ts に追記してはならない
 * （RDRA の BUC / 画面に無いルートは作らない）。
 */

export interface AppNavigationValue {
  /** 現在のルート */
  route: AppRoute
  /** 現在のパスパラメータ */
  params: Record<string, string>
  /** 現在の URL */
  pathname: string
  /** ルート id を指定して遷移する */
  navigate: (id: string, params?: Record<string, string | number>) => void
  /** ルート id から href を作る（アンカー用） */
  href: (id: string, params?: Record<string, string | number>) => string
}

export const AppNavigationContext = React.createContext<AppNavigationValue | null>(null)

export interface AppShellProps {
  /** 表示するルート id（routes.ts の id） */
  routeId: string
  /** パスパラメータ */
  params?: Record<string, string>
  /**
   * 実装リポの router を差し込む唯一の口。
   * 省略時は遷移せず、Storybook 上の表示専用になる。
   */
  onNavigate?: (target: { path: string; routeId: string; params: Record<string, string> }) => void
  /** 画面見出し。省略時はルート表の画面名 */
  title?: string
  description?: React.ReactNode
  breadcrumb?: Breadcrumb[]
  actions?: React.ReactNode
  width?: 'contained' | 'full'
  collapsed?: boolean
  children: React.ReactNode
}

/** ナビ id → そのポータルの代表ルート（サイドバー遷移先） */
function navEntryRoute(portal: PortalId, navId: string): AppRoute | undefined {
  return routesOf(portal).find((r) => r.nav === navId && r.params.length === 0)
}

export const AppShell: React.FC<AppShellProps> = ({
  routeId,
  params = {},
  onNavigate,
  title,
  description,
  breadcrumb,
  actions,
  width,
  collapsed,
  children,
}) => {
  const route = getRoute(routeId)
  const pathname = buildPath(routeId, params)

  const value = React.useMemo<AppNavigationValue>(
    () => ({
      route,
      params,
      pathname,
      navigate: (id, next = {}) => {
        const target = getRoute(id)
        onNavigate?.({
          path: buildPath(id, next),
          routeId: id,
          params: Object.fromEntries(
            Object.entries(next).map(([k, v]) => [k, String(v)]),
          ),
        })
        if (!onNavigate && typeof console !== 'undefined') {
          // router 未注入（Storybook 等）。遷移先だけ通知する
          console.info(`[AppShell] navigate → ${target.id} (${buildPath(id, next)})`)
        }
      },
      href: (id, next = {}) => buildPath(id, next),
    }),
    [route, params, pathname, onNavigate],
  )

  return (
    <AppNavigationContext.Provider value={value}>
      <PortalPageLayout
        portal={route.portal}
        title={title ?? route.screen}
        description={description}
        breadcrumb={breadcrumb}
        actions={actions}
        width={width}
        collapsed={collapsed}
        activeNavId={route.nav}
        onNavigate={(navId) => {
          const entry = navEntryRoute(route.portal, navId)
          if (entry) value.navigate(entry.id)
        }}
      >
        {children}
      </PortalPageLayout>
    </AppNavigationContext.Provider>
  )
}

/**
 * URL からルートを解決してシェルを描画する。実装リポの router アダプタ用の入口。
 * ポータル外・未登録の URL はここで弾き、画面側に判定を持ち込まない。
 */
export const AppShellByPath: React.FC<
  Omit<AppShellProps, 'routeId' | 'params'> & { pathname: string; portal?: PortalId }
> = ({ pathname, portal, children, ...rest }) => {
  const matched = matchPath(pathname)

  if (!matched) {
    return (
      <Alert tone="destructive" title="ページが見つかりません">
        {pathname} に対応する画面はありません。
      </Alert>
    )
  }
  if (portal && matched.route.portal !== portal) {
    return (
      <Alert tone="destructive" title="このポータルでは表示できません">
        {matched.route.screen} は{matched.route.portal === 'staff' ? '司書' : '利用者'}
        ポータルの画面です。
      </Alert>
    )
  }

  return (
    <AppShell routeId={matched.route.id} params={matched.params} {...rest}>
      {children}
    </AppShell>
  )
}

export { appRoutes }
