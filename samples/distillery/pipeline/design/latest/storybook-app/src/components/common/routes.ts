/**
 * アプリのルート定義（URL の正本）。
 *
 * design-event.yaml の `screens[].route` と 1:1 で対応する唯一のルート表。
 * - 画面・Story・実装リポの router は必ずこの表を経由し、URL 文字列を直接書かない。
 * - RDRA の BUC / 画面に無いルートをここへ追加してはならない（追加は design ステージの責務）。
 * - 所有者: デザインシステム（本ファイル）。実装リポはこの表を読み取って router を組み立てる。
 *
 * 生成元: docs/design/latest/design-event.yaml screens[]（41 画面）
 */

export type PortalId = 'patron' | 'staff'

export interface AppRoute {
  /** ルート識別子。画面遷移は必ずこの id で指定する */
  id: string
  /** URL パターン。`:paramName` がパスパラメータ */
  path: string
  /** 所属ポータル。AppShell はポータル外のルートを描画しない */
  portal: PortalId
  /** RDRA 画面名 */
  screen: string
  /** RDRA UC 名 */
  uc: string
  /** RDRA 業務名 */
  business: string
  /** サイドバーのアクティブ項目（PortalShell の nav id） */
  nav: string
  /** パスパラメータ名 */
  params: string[]
}

export const appRoutes: AppRoute[] = [
  {
    id: 'patron-book-search',
    path: '/search',
    portal: 'patron',
    screen: '蔵書検索画面',
    uc: '書籍を検索する',
    business: '蔵書利用業務',
    nav: 'search',
    params: [],
  },
  {
    id: 'patron-book-detail',
    path: '/books/:bookId',
    portal: 'patron',
    screen: '書籍詳細・在庫状況画面',
    uc: '書籍詳細と在庫状況を照会する',
    business: '蔵書利用業務',
    nav: 'search',
    params: ['bookId'],
  },
  {
    id: 'patron-reservation-new',
    path: '/books/:bookId/reserve',
    portal: 'patron',
    screen: '書籍予約申込画面',
    uc: '予約を登録する',
    business: '予約管理業務',
    nav: 'reservations',
    params: ['bookId'],
  },
  {
    id: 'patron-reservation-cancel',
    path: '/reservations/:reservationId/cancel',
    portal: 'patron',
    screen: '予約取消受付画面',
    uc: '予約を取り消す',
    business: '予約管理業務',
    nav: 'reservations',
    params: ['reservationId'],
  },
  {
    id: 'patron-reservation-rank',
    path: '/reservations/:reservationId/rank',
    portal: 'patron',
    screen: '予約順位確認画面',
    uc: '自分の予約順位を照会する',
    business: '予約管理業務',
    nav: 'reservations',
    params: ['reservationId'],
  },
  {
    id: 'patron-reservation-list',
    path: '/reservations',
    portal: 'patron',
    screen: '予約状況一覧画面',
    uc: '自分の予約状況を照会する',
    business: '利用照会業務',
    nav: 'loans',
    params: [],
  },
  {
    id: 'patron-hold-list',
    path: '/reservations/holds',
    portal: 'patron',
    screen: '取置き中予約確認画面',
    uc: '自分の取置き中の予約を照会する',
    business: '利用照会業務',
    nav: 'reservations',
    params: [],
  },
  {
    id: 'patron-hold-detail',
    path: '/reservations/holds/:reservationId',
    portal: 'patron',
    screen: '取置き受取案内画面',
    uc: '自分の取置き状況を照会する',
    business: '予約管理業務',
    nav: 'reservations',
    params: ['reservationId'],
  },
  {
    id: 'patron-loan-list',
    path: '/loans',
    portal: 'patron',
    screen: '現在の貸出一覧画面',
    uc: '自分の現在の貸出を照会する',
    business: '利用照会業務',
    nav: 'loans',
    params: [],
  },
  {
    id: 'patron-loan-detail',
    path: '/loans/:loanId',
    portal: 'patron',
    screen: '貸出内容・返却期限確認画面',
    uc: '自分の貸出内容と返却期限を照会する',
    business: '蔵書利用業務',
    nav: 'loans',
    params: ['loanId'],
  },
  {
    id: 'patron-loan-history',
    path: '/loans/history',
    portal: 'patron',
    screen: '貸出履歴画面',
    uc: '自分の貸出履歴を照会する',
    business: '利用照会業務',
    nav: 'history',
    params: [],
  },
  {
    id: 'patron-loan-due',
    path: '/loans/due',
    portal: 'patron',
    screen: '返却期限リマインド確認画面',
    uc: '自分の返却期限を照会する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'patron-loan-overdue',
    path: '/loans/overdue',
    portal: 'patron',
    screen: '延滞返却対象確認画面',
    uc: '自分の延滞中の貸出を照会する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'patron-loan-return-target',
    path: '/loans/return',
    portal: 'patron',
    screen: '返却対象貸出確認画面',
    uc: '返却対象の貸出を照会する',
    business: '蔵書利用業務',
    nav: 'loans',
    params: [],
  },
  {
    id: 'patron-loan-returned',
    path: '/loans/returned',
    portal: 'patron',
    screen: '返却完了確認画面',
    uc: '自分の返却済み貸出を照会する',
    business: '蔵書利用業務',
    nav: 'history',
    params: [],
  },
  {
    id: 'patron-mypage',
    path: '/mypage',
    portal: 'patron',
    screen: 'マイページ登録内容画面',
    uc: '自分の利用者情報を照会する',
    business: '利用者管理業務',
    nav: 'mypage',
    params: [],
  },
  {
    id: 'patron-mypage-card',
    path: '/mypage/card',
    portal: 'patron',
    screen: '利用者番号提示画面',
    uc: '利用者番号で貸出対象利用者を特定する',
    business: '蔵書利用業務',
    nav: 'mypage',
    params: [],
  },
  {
    id: 'staff-book-list',
    path: '/staff/books',
    portal: 'staff',
    screen: '蔵書管理台帳画面',
    uc: '蔵書一覧を照会する',
    business: '蔵書管理業務',
    nav: 'collection',
    params: [],
  },
  {
    id: 'staff-book-new',
    path: '/staff/books/new',
    portal: 'staff',
    screen: '書籍受入登録画面',
    uc: '書籍を登録する',
    business: '蔵書管理業務',
    nav: 'collection',
    params: [],
  },
  {
    id: 'staff-book-edit',
    path: '/staff/books/:bookId/edit',
    portal: 'staff',
    screen: '書誌情報訂正画面',
    uc: '書籍情報を編集する',
    business: '蔵書管理業務',
    nav: 'collection',
    params: ['bookId'],
  },
  {
    id: 'staff-book-withdraw',
    path: '/staff/books/:bookId/withdraw',
    portal: 'staff',
    screen: '除籍手続画面',
    uc: '書籍を削除する',
    business: '蔵書管理業務',
    nav: 'collection',
    params: ['bookId'],
  },
  {
    id: 'staff-book-reference-search',
    path: '/staff/books/reference-search',
    portal: 'staff',
    screen: 'レファレンス検索画面',
    uc: '司書向けに蔵書を検索する',
    business: '蔵書利用業務',
    nav: 'use',
    params: [],
  },
  {
    id: 'staff-user-list',
    path: '/staff/users',
    portal: 'staff',
    screen: '利用者名簿画面',
    uc: '利用者一覧を照会する',
    business: '利用者管理業務',
    nav: 'user',
    params: [],
  },
  {
    id: 'staff-user-new',
    path: '/staff/users/new',
    portal: 'staff',
    screen: '利用申込受付画面',
    uc: '利用者を登録する',
    business: '利用者管理業務',
    nav: 'user',
    params: [],
  },
  {
    id: 'staff-user-edit',
    path: '/staff/users/:userNumber/edit',
    portal: 'staff',
    screen: '利用者情報変更画面',
    uc: '利用者情報を編集する',
    business: '利用者管理業務',
    nav: 'user',
    params: ['userNumber'],
  },
  {
    id: 'staff-user-withdraw',
    path: '/staff/users/:userNumber/withdraw',
    portal: 'staff',
    screen: '退会手続画面',
    uc: '利用者を削除する',
    business: '利用者管理業務',
    nav: 'user',
    params: ['userNumber'],
  },
  {
    id: 'staff-loan-eligibility',
    path: '/staff/loans/eligibility',
    portal: 'staff',
    screen: '貸出可否判定画面',
    uc: '書籍の貸出可否を判定する',
    business: '蔵書利用業務',
    nav: 'use',
    params: [],
  },
  {
    id: 'staff-loan-new',
    path: '/staff/loans/new',
    portal: 'staff',
    screen: '窓口貸出受付画面',
    uc: '貸出を登録する',
    business: '蔵書利用業務',
    nav: 'use',
    params: [],
  },
  {
    id: 'staff-return-new',
    path: '/staff/returns/new',
    portal: 'staff',
    screen: '窓口返却受付画面',
    uc: '返却を登録する',
    business: '蔵書利用業務',
    nav: 'use',
    params: [],
  },
  {
    id: 'staff-return-restock',
    path: '/staff/returns/:loanId/restock',
    portal: 'staff',
    screen: '返却後在庫整理画面',
    uc: '返却後の書籍状態を更新する',
    business: '蔵書利用業務',
    nav: 'use',
    params: ['loanId'],
  },
  {
    id: 'staff-duedate-upcoming',
    path: '/staff/duedates/upcoming',
    portal: 'staff',
    screen: '返却期限接近貸出一覧画面',
    uc: '返却期限接近の貸出を判定する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'staff-duedate-remind',
    path: '/staff/duedates/remind',
    portal: 'staff',
    screen: 'リマインド送信画面',
    uc: 'リマインドメールを送信する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'staff-overdue-judge',
    path: '/staff/overdues/judge',
    portal: 'staff',
    screen: '延滞判定結果確認画面',
    uc: '期限超過の貸出を延滞にする',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'staff-overdue-list',
    path: '/staff/overdues',
    portal: 'staff',
    screen: '延滞状況一覧画面',
    uc: '延滞中の貸出を照会する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'staff-overdue-dun',
    path: '/staff/overdues/dun',
    portal: 'staff',
    screen: '督促送信画面',
    uc: '督促メールを送信する',
    business: '貸出期限管理業務',
    nav: 'duedate',
    params: [],
  },
  {
    id: 'staff-hold-next',
    path: '/staff/holds/next',
    portal: 'staff',
    screen: '取置き対象者特定画面',
    uc: '予約順1位の利用者を特定する',
    business: '予約管理業務',
    nav: 'reservation',
    params: [],
  },
  {
    id: 'staff-hold-notify',
    path: '/staff/holds/notify',
    portal: 'staff',
    screen: '取置き通知送信画面',
    uc: '取置き通知メールを送信する',
    business: '予約管理業務',
    nav: 'reservation',
    params: [],
  },
  {
    id: 'staff-report-inventory-new',
    path: '/staff/reports/inventory/new',
    portal: 'staff',
    screen: '在庫状況集計条件指定画面',
    uc: '在庫状況を区分別に集計する',
    business: '蔵書分析業務',
    nav: 'analysis',
    params: [],
  },
  {
    id: 'staff-report-inventory',
    path: '/staff/reports/inventory',
    portal: 'staff',
    screen: '在庫状況レポート画面',
    uc: '在庫状況レポートを参照する',
    business: '蔵書分析業務',
    nav: 'analysis',
    params: [],
  },
  {
    id: 'staff-report-loans-new',
    path: '/staff/reports/loans/new',
    portal: 'staff',
    screen: '集計期間指定画面',
    uc: '期間別貸出統計を集計する',
    business: '蔵書分析業務',
    nav: 'analysis',
    params: [],
  },
  {
    id: 'staff-report-loans',
    path: '/staff/reports/loans',
    portal: 'staff',
    screen: '貸出統計レポート画面',
    uc: '貸出統計レポートを参照する',
    business: '蔵書分析業務',
    nav: 'analysis',
    params: [],
  },
]

export const appRouteIds = appRoutes.map((r) => r.id)

const byId = new Map(appRoutes.map((r) => [r.id, r]))

/** ルート id からルート定義を引く。未登録 id は実装バグとして落とす */
export function getRoute(id: string): AppRoute {
  const route = byId.get(id)
  if (!route) throw new Error(`unknown route id: ${id}`)
  return route
}

export function routesOf(portal: PortalId): AppRoute[] {
  return appRoutes.filter((r) => r.portal === portal)
}

/** ルート id + パラメータから URL を作る。画面側で URL を文字列連結してはならない */
export function buildPath(id: string, params: Record<string, string | number> = {}): string {
  const route = getRoute(id)
  return route.path.replace(/:([A-Za-z][A-Za-z0-9]*)/g, (_m, key: string) => {
    const value = params[key]
    if (value == null || value === '') throw new Error(`missing route param "${key}" for ${id}`)
    return encodeURIComponent(String(value))
  })
}

export interface RouteMatch {
  route: AppRoute
  params: Record<string, string>
}

/** URL からルートを解決する。静的セグメントが多い定義を優先する */
export function matchPath(pathname: string): RouteMatch | null {
  const target = pathname.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/'
  const segs = target.split('/').filter(Boolean)
  const candidates = appRoutes
    .map((route) => ({ route, parts: route.path.split('/').filter(Boolean) }))
    .filter((c) => c.parts.length === segs.length)
    .sort((a, b) => staticCount(b.parts) - staticCount(a.parts))

  for (const { route, parts } of candidates) {
    const params: Record<string, string> = {}
    let ok = true
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]
      if (part.startsWith(':')) params[part.slice(1)] = decodeURIComponent(segs[i])
      else if (part !== segs[i]) {
        ok = false
        break
      }
    }
    if (ok) return { route, params }
  }
  return null
}

function staticCount(parts: string[]): number {
  return parts.filter((p) => !p.startsWith(':')).length
}
