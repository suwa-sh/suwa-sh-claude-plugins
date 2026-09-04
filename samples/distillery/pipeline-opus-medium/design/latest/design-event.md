# Design System: Libra

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260902_145539_design_system + 20260902_183502_spec_stories + 20260902_185951_design_system + 20260902_201117_spec_stories |
| Created At | 2026-09-02T20:11:17 (最終更新) |
| Source | dist-pipeline Step5 (design) / distillery:dist-design-system design_generation=required / dialogue_policy=auto_adopt + dist-spec-stories: 共通コンポーネント10種+フック3種、全41 UC のページ Story を生成 + dist-design-system feedback 20260902_184257_impl_feedback_d0f57ea2: loading 表現（Spinner / LoadingState）とアプリシェル・ルーティング所有権（AppShell / routes.ts / useAppNavigation）を追加 + dist-spec-stories feedback 20260902_184257_impl_feedback_d0f57ea2: 日付・期限の表示規約（dateFormat.ts）と LoanConfirmation の Props/イベント契約を追加 |
| Portals | 2 |
| Components | 53 (UI: 14, Domain: 19, Common: 20) |
| Screens | 41 |
| Page Stories | 41 |

## Brand

- **Name**: Libra
- **Primary Color**: Libra Blue（利用者ポータル / ブランド基調色） (#1D4ED8)
- **Secondary Color**: Stack Teal（司書ポータル） (#0F766E)
- **Sans Font**: Noto Sans JP, Inter, Hiragino Sans, Yu Gothic UI, system-ui, sans-serif
- **Mono Font**: JetBrains Mono, SFMono-Regular, Consolas, Menlo, monospace
- **Type Scale**: xs, sm, base, lg, xl, 2xl, 3xl
- **Tone**: 信頼・堅実。公共サービスとして、断定しすぎず、次に何をすればよいかを必ず示す
- **Principles**: 利用者には「できること」を先に伝える（在庫あり / 予約できます / あと N 日）, 司書には「判定結果と根拠」を並べて示す（貸出できません + 蔵書削除制限ポリシー）, 個人情報は既定で伏せ、必要なときだけ明示操作で開く, 色だけで意味を伝えない。必ず文言かアイコンを添える（JIS X 8341-3 AA 目標）, 専門用語は RDRA の業務用語をそのまま使う（除籍 / 取置き / 督促）
- **Logo Variants**:
  - full: `assets/logo-full.svg`
  - icon: `assets/logo-icon.svg`
  - stacked: `assets/logo-stacked.svg`

## Portals

| ID | Name | Actor | Primary Color | Screen Count |
|-----|------|-------|:-------------:|:------------:|
| patron | 利用者ポータル | 利用者 | #1D4ED8 | 17 |
| staff | 司書ポータル | 司書 | #0F766E | 24 |

## Design Tokens

### Primitive

- **Color Scales**: white, black, gray, blue, teal, green, amber, orange, red, violet (10 scales)
- **Spacing Scale**: "0": 0rem, "1": 0.25rem, "2": 0.5rem, "3": 0.75rem, "4": 1rem, "5": 1.25rem, "6": 1.5rem, "8": 2rem, "10": 2.5rem, "12": 3rem, "16": 4rem
- **Radius**: none, sm, md, lg, xl, full
- **Shadow**: none, sm, md, lg
- **Font Size**: xs, sm, base, lg, xl, 2xl, 3xl
- **Duration**: fast, normal, slow

### Semantic

- **background**: var(--color-white)
- **background_subtle**: var(--color-gray-50)
- **background_muted**: var(--color-gray-100)
- **foreground**: var(--color-gray-900)
- **foreground_secondary**: var(--color-gray-600)
- **foreground_muted**: var(--color-gray-500)
- **foreground_inverse**: var(--color-white)
- **border**: var(--color-gray-200)
- **border_strong**: var(--color-gray-300)
- **ring**: var(--color-blue-500)
- **hover_muted**: var(--color-gray-100)
- **active_muted**: var(--color-gray-200)
- **success**: var(--color-green-600)
- **warning**: var(--color-amber-600)
- **destructive**: var(--color-red-600)
- **info**: var(--color-blue-600)
- **neutral**: var(--color-gray-500)
- **pending**: var(--color-orange-600)
- **analysis**: var(--color-violet-600)
- **primary_patron**: var(--color-blue-700)
- **primary_staff**: var(--color-teal-700)
- **sidebar_width**: 16rem
- **sidebar_collapsed_width**: 4rem
- **content_max_width**: 80rem
- **page_padding**: var(--spacing-6)
- **section_gap**: var(--spacing-8)
- **component_gap**: var(--spacing-3)
- **card_padding**: var(--spacing-6)
- **grid_columns**: 12

### Component

- **button**: height_sm, height_md, height_lg, padding_x, radius, font_size, font_weight
- **input**: height, padding_x, radius, bg, border, focus_ring, placeholder
- **card**: bg, border, shadow, radius, padding
- **badge**: height, padding_x, radius, font_size, font_weight
- **table**: header_bg, header_foreground, row_height, cell_padding_x, cell_padding_y, border, row_hover_bg
- **sidebar**: bg, foreground, border, item_height, item_active_bg, item_active_foreground
- **modal**: backdrop, bg, radius, padding, shadow, width_sm, width_md
- **alert**: radius, padding
- **skeleton**: bg, highlight
- **spinner**: track, indicator, thickness, thickness_lg, size_sm, size_md, size_lg, duration
- **overlay**: backdrop, blur
- **pagination**: item_size, radius
- **duedate**: safe_color, safe_bg, near_color, near_bg, over_color, over_bg
- **queue**: track_bg, active_bg, done_bg, label_color
- **kpi**: bg, value_color, label_color, accent
- **chart**: bar_bg, bar_muted_bg, grid, axis_label
- **pii**: mask_bg, mask_color

### Dark Mode Overrides

**Semantic overrides:**

- **background**: var(--color-gray-950)
- **background_subtle**: var(--color-gray-900)
- **background_muted**: var(--color-gray-800)
- **foreground**: var(--color-gray-50)
- **foreground_secondary**: var(--color-gray-300)
- **foreground_muted**: var(--color-gray-400)
- **border**: var(--color-gray-700)
- **border_strong**: var(--color-gray-600)
- **hover_muted**: var(--color-gray-700)
- **active_muted**: var(--color-gray-600)
- **success_light**: rgba(22, 163, 74, 0.18)
- **warning_light**: rgba(217, 119, 6, 0.18)
- **destructive_light**: rgba(220, 38, 38, 0.18)
- **info_light**: rgba(37, 99, 235, 0.18)
- **neutral_light**: rgba(100, 116, 139, 0.18)
- **pending_light**: rgba(234, 88, 12, 0.18)
- **analysis_light**: rgba(124, 58, 237, 0.18)
- **primary_patron**: var(--color-blue-400)
- **primary_staff**: var(--color-teal-400)

**Component overrides:**

- **card_bg**: var(--color-gray-900)
- **card_border**: var(--color-gray-700)
- **card_shadow**: 0 1px 2px 0 rgba(0, 0, 0, 0.5)
- **input_bg**: var(--color-gray-900)
- **input_border**: var(--color-gray-600)
- **table_header_bg**: var(--color-gray-800)
- **table_row_hover_bg**: var(--color-gray-800)
- **sidebar_bg**: var(--color-gray-900)
- **sidebar_border**: var(--color-gray-700)
- **modal_bg**: var(--color-gray-900)
- **modal_backdrop**: rgba(2, 6, 23, 0.7)
- **skeleton_bg**: var(--color-gray-700)
- **spinner_track**: var(--color-gray-700)
- **overlay_backdrop**: rgba(2, 6, 23, 0.72)
- **duedate_safe_bg**: rgba(22, 163, 74, 0.18)
- **duedate_near_bg**: rgba(234, 88, 12, 0.18)
- **duedate_over_bg**: rgba(220, 38, 38, 0.18)
- **queue_track_bg**: var(--color-gray-700)
- **chart_grid**: var(--color-gray-700)
- **pii_mask_bg**: var(--color-gray-800)

## Components

### UI Components

| Name | Variants | Sizes |
|------|----------|-------|
| Button | default, secondary, outline, ghost, destructive | sm, md, lg |
| Badge | default, success, warning, destructive, info, neutral, pending, analysis, outline | - |
| Card | default, hoverable, flush | - |
| Input | default, with-icon, with-suffix, error, disabled | - |
| ToggleGroup | single, multi | sm, md |
| Table | default, empty | - |
| Alert | info, success, warning, destructive | - |
| EmptyState | default, with-action | - |
| Skeleton | line, table, card, detail | - |
| Spinner | inline, button, overlay | sm, md, lg |
| Pagination | default, single-page | - |
| Modal | confirm, destructive-confirm | sm, md |
| Icon | outlined | - |
| PortalShell | patron, staff, collapsed | - |

### Domain Components

| Name | Description | Screens |
|------|-------------|---------|
| BookStatusBadge | 書籍状態（在庫あり / 貸出中 / 予約待ち）を色とアイコンで示す。検索結果・台帳・詳細で共通に使う | 蔵書検索画面, 蔵書管理台帳画面, 書籍詳細・在庫状況画面, レファレンス検索画面, 返却後在庫整理画面, 除籍手続画面 |
| LoanStatusBadge | 貸出状態（貸出中 / 延滞 / 返却済み）を示す | 現在の貸出一覧画面, 貸出履歴画面, 延滞状況一覧画面, 窓口返却受付画面, 返却完了確認画面 |
| ReservationStatusBadge | 予約状態（予約中 / 取置き中 / 貸出済み / キャンセル）を示す | 予約状況一覧画面, 取置き中予約確認画面, 予約取消受付画面, 取置き対象者特定画面 |
| UserStatusBadge | 利用者状態（登録済み / 取引進行中）を示す。取引進行中は削除不可の根拠表示に使う | 利用者名簿画面, マイページ登録内容画面, 退会手続画面, 利用者情報変更画面 |
| NotificationStatusBadge | 通知状態（送信待ち / 送信済み / 送信失敗）を示す。未達の追跡に使う | 取置き通知送信画面, リマインド送信画面, 督促送信画面 |
| ReportStatusBadge | 統計レポート状態（集計中 / 作成済み / 実績なし）を示す | 在庫状況レポート画面, 貸出統計レポート画面, 在庫状況集計条件指定画面, 集計期間指定画面 |
| BookCard | 書籍 1 件のカード表示。タイトル・著者・ISBN・出版社・ジャンル・資料種別・書籍状態・予約件数を一覧できる | 蔵書検索画面, 書籍詳細・在庫状況画面, 蔵書管理台帳画面, レファレンス検索画面 |
| BookSearchFilter | 検索条件種別（単一選択）・ジャンル（複数選択）・資料種別（複数選択）・在庫ありのみ を button トグルで指定する検索フィルター | 蔵書検索画面, レファレンス検索画面 |
| DueDateIndicator | 返却期限の残日数・超過日数を 3 段階（余裕あり / 期限接近 / 超過）で視覚化する。色だけに依存せず日数を文言で示す | 現在の貸出一覧画面, 貸出内容・返却期限確認画面, 返却期限リマインド確認画面, 返却期限接近貸出一覧画面, 延滞状況一覧画面, 延滞返却対象確認画面 |
| LoanTable | 貸出一覧のテーブル。司書向けには利用者列を出し、利用者向けには本人の貸出のみを表示する | 現在の貸出一覧画面, 貸出履歴画面, 延滞状況一覧画面, 返却期限接近貸出一覧画面, 返却対象貸出確認画面, 返却完了確認画面, 延滞判定結果確認画面 |
| LoanConfirmation | 窓口貸出受付画面の完了表示（表示専用）。result: LoanResponse \| null を確定値として受け取り、null の間は描画しない。次の行動導線は onLoanSucceeded(result) で親へ通知する | 窓口貸出受付画面 |
| ReservationQueueTracker | 予約順位と進行状況（予約中 → 取置き中 → 貸出済み）をステップで示す。キャンセルは中立表示にする | 予約順位確認画面, 予約状況一覧画面, 取置き中予約確認画面, 書籍予約申込画面 |
| HoldPickupCard | 取置き案内カード。窓口で提示する利用者番号を大きく表示し、取置き期限までの来館を促す | 取置き受取案内画面, 取置き中予約確認画面 |
| UserProfileCard | 利用者の登録内容カード。連絡先は既定でマスクし、明示操作で開示する（NFR E.1.2.1 / arch SR-006） | マイページ登録内容画面, 利用者情報変更画面, 退会手続画面, 利用者番号提示画面 |
| UserTable | 利用者名簿のテーブル。連絡先は常時マスクし、貸出中・予約中の件数から削除可否を読み取れるようにする | 利用者名簿画面 |
| NotificationLogTable | 通知の送信実績一覧。送信失敗の行だけ再送操作を出し、未達件数を上部の警告で知らせる | 取置き通知送信画面, リマインド送信画面, 督促送信画面 |
| ReportKpiCard | レポートの KPI カード。値は等幅・桁揃えで表示し、前期比を増減つきで示す | 在庫状況レポート画面, 貸出統計レポート画面 |
| ReportPeriodSelector | レポート種別（在庫状況 / 人気書籍ランキング / 期間別貸出統計）と集計期間区分（日次 / 月次 / 年次）・集計期間を指定する | 在庫状況集計条件指定画面, 集計期間指定画面 |
| LoanTrendChart | 期間別貸出統計の棒グラフ。外部ライブラリを使わず SVG/div で描き、内容を aria-label でも伝える | 貸出統計レポート画面, 在庫状況レポート画面 |

### Common Components

| Name | Description |
|------|-------------|
| PortalShell | 両ポータル共通のレイアウト骨格（サイドバー 16rem + ヘッダー + コンテンツ）。ナビは RDRA 業務 7 件 + 共通メニュー 2 件 |
| stateMaps | RDRA 状態モデル 6 種とバリエーション 9 種の定数・Badge マッピング。ここに無い状態を追加してはならない |
| Icon | Lucide 準拠のインライン SVG アイコン（42 種）。currentColor でトークン着色できる |
| PortalPageLayout | 全 41 UC が使う共通レイアウトシェル。PortalShell + Icon + Logo の合成。portal/title/breadcrumb/actions/width で画面差分を吸収し、画面側にポータル色・ナビ定義を書かせない。フッターと本文スキップリンクもここに集約する |
| AsyncSection | 一覧・詳細取得系画面の Skeleton / EmptyState / Alert(destructive) 3 状態を統一する（Skeleton + EmptyState + Alert の合成） |
| DataListSection | 「フィルター → 一覧 → ページ送り」の縦積みレイアウトと 20 件/頁の分割を統一する（Table/Domain テーブル + Pagination + AsyncSection の合成） |
| FilterPanel | 単一/複数選択トグル + 検索語 + 実行ボタン + 結果件数の並びと詳細条件の折りたたみを統一する（ToggleGroup + Input + Button の合成） |
| EntityFormSection | フォームのレイアウト・ラベル・エラー表示・送信中無効化を統一し、edit モードで現在値との差分サマリを出す（Card + Input + ToggleGroup + Alert + Button の合成） |
| ConfirmActionModal | 確認ダイアログの文言構造（対象名再掲→影響明示→取消可否）とフォーカス制御を統一する（Modal + Button + Alert の合成） |
| SubmitActionButton | 更新系 API の二重送信防止（冪等キー・aria-busy・disabled）を集約する（Button の合成） |
| PiiMaskedText | 連絡先など個人情報の既定マスクと明示操作による開示を集約する（pii トークン + Button(ghost) の合成） |
| NotificationLogSection | 通知 3 UC（取置き通知/リマインド/督促）共通の送信対象サマリ→送信実行→実績一覧→再送のテンプレート（NotificationLogTable + NotificationStatusBadge + Alert + SubmitActionButton の合成） |
| ReportSummarySection | KPI行→推移チャート→明細テーブルの情報階層とレポート状態表現を統一する（ReportKpiCard + LoanTrendChart + ReportStatusBadge + Table + EmptyState の合成） |
| useListQueryState | 一覧の検索条件・ページをクエリパラメータ相当の状態と同期する（画面をまたぐ共有状態を持たない） |
| useIdempotentMutation | 画面表示時に冪等キー（UUID）を発行し、送信・再送で同一キーを維持する |
| useApiErrorPresenter | API エラーを4分類（通信/認可/業務ルール違反/競合）に正規化し、表示先と重篤度を決める |
| LoadingState | loading 表現の唯一の入口。kind で Skeleton / Spinner を出し分ける（list=SkeletonTable / card=SkeletonCard / detail=SkeletonDetail / line=Skeleton / action=Spinner(inline) / page=Spinner(overlay)）。同一領域で Skeleton と Spinner を併用せず、常に aria-busy と読み上げラベルを伴う。ちらつきが問題になる領域だけ delayMs（推奨 300ms）で遅延表示する。画面側で独自 loading UI を作ってはならない。画面実装は LoadingState だけを import し、Skeleton / Spinner を直接 import しない（実体は components.ui[].path = src/components/ui/Feedback.tsx に同居する） |
| AppShell | アプリのエントリポイント兼シェル（AppShell / AppShellByPath）。ルート id または URL からポータル・画面名・アクティブナビを解決し、404 とポータル外アクセスを判定する。デザインシステムが所有し、実装リポは onNavigate に router.push を注入して children にページ本体を渡すだけにする |
| appRoutes | URL の正本となるルート表（41 件）。screens[].route と 1:1 で route id / path / portal / 画面 / UC / 業務 / nav / params を定義する。getRoute・buildPath・matchPath・routesOf を提供し、画面側の URL 文字列直書きを禁止する。RDRA の BUC / 画面に無いルートを追加してはならない |
| useAppNavigation | 画面遷移の唯一の API。ルート id 指定で navigate / href を行い、AppShell の外で使うと例外にしてシェル未装着を早期検出する |

## Screen Mapping

### 利用者ポータル (patron)

| Name | Route | Components |
|------|-------|------------|
| 蔵書検索画面 | /search | PortalShell, BookSearchFilter, BookCard, Pagination, EmptyState, Skeleton |
| 書籍詳細・在庫状況画面 | /books/:bookId | PortalShell, BookCard, BookStatusBadge, ReservationQueueTracker, Button, Alert |
| 書籍予約申込画面 | /books/:bookId/reserve | PortalShell, BookCard, ReservationQueueTracker, Alert, Button, Modal |
| 予約取消受付画面 | /reservations/:reservationId/cancel | PortalShell, ReservationStatusBadge, Modal, Alert, Button |
| 予約順位確認画面 | /reservations/:reservationId/rank | PortalShell, ReservationQueueTracker, BookCard, Card |
| 予約状況一覧画面 | /reservations | PortalShell, ReservationStatusBadge, ReservationQueueTracker, Table, EmptyState, Pagination |
| 取置き中予約確認画面 | /reservations/holds | PortalShell, HoldPickupCard, ReservationStatusBadge, EmptyState |
| 取置き受取案内画面 | /reservations/holds/:reservationId | PortalShell, HoldPickupCard, Alert, Button |
| 現在の貸出一覧画面 | /loans | PortalShell, LoanTable, DueDateIndicator, LoanStatusBadge, EmptyState |
| 貸出内容・返却期限確認画面 | /loans/:loanId | PortalShell, Card, DueDateIndicator, LoanStatusBadge, BookCard |
| 貸出履歴画面 | /loans/history | PortalShell, LoanTable, Pagination, EmptyState |
| 返却期限リマインド確認画面 | /loans/due | PortalShell, DueDateIndicator, LoanTable, Alert |
| 延滞返却対象確認画面 | /loans/overdue | PortalShell, LoanTable, DueDateIndicator, Alert |
| 返却対象貸出確認画面 | /loans/return | PortalShell, LoanTable, DueDateIndicator, Button |
| 返却完了確認画面 | /loans/returned | PortalShell, LoanTable, LoanStatusBadge, Alert, EmptyState |
| マイページ登録内容画面 | /mypage | PortalShell, UserProfileCard, UserStatusBadge |
| 利用者番号提示画面 | /mypage/card | PortalShell, UserProfileCard, Card, Alert |

### 司書ポータル (staff)

| Name | Route | Components |
|------|-------|------------|
| 蔵書管理台帳画面 | /staff/books | PortalShell, Table, BookStatusBadge, BookSearchFilter, Pagination, EmptyState, Button |
| 書籍受入登録画面 | /staff/books/new | PortalShell, Card, Input, ToggleGroup, Button, Alert |
| 書誌情報訂正画面 | /staff/books/:bookId/edit | PortalShell, Card, Input, ToggleGroup, BookStatusBadge, Button |
| 除籍手続画面 | /staff/books/:bookId/withdraw | PortalShell, BookCard, BookStatusBadge, Alert, Modal, Button |
| レファレンス検索画面 | /staff/books/reference-search | PortalShell, BookSearchFilter, Table, BookStatusBadge, Pagination |
| 利用者名簿画面 | /staff/users | PortalShell, UserTable, UserStatusBadge, Pagination, EmptyState, Button |
| 利用申込受付画面 | /staff/users/new | PortalShell, Card, Input, ToggleGroup, Button, Alert |
| 利用者情報変更画面 | /staff/users/:userNumber/edit | PortalShell, UserProfileCard, Input, ToggleGroup, Button |
| 退会手続画面 | /staff/users/:userNumber/withdraw | PortalShell, UserProfileCard, UserStatusBadge, Alert, Modal, Button |
| 貸出可否判定画面 | /staff/loans/eligibility | PortalShell, BookCard, UserProfileCard, Alert, BookStatusBadge, Button |
| 窓口貸出受付画面 | /staff/loans/new | PortalShell, Input, ToggleGroup, BookCard, UserProfileCard, DueDateIndicator, LoanConfirmation, Button |
| 窓口返却受付画面 | /staff/returns/new | PortalShell, Input, LoanTable, LoanStatusBadge, DueDateIndicator, Button, Alert |
| 返却後在庫整理画面 | /staff/returns/:loanId/restock | PortalShell, BookCard, BookStatusBadge, ReservationStatusBadge, Alert, Button |
| 返却期限接近貸出一覧画面 | /staff/duedates/upcoming | PortalShell, LoanTable, DueDateIndicator, Pagination, Button |
| リマインド送信画面 | /staff/duedates/remind | PortalShell, NotificationLogTable, NotificationStatusBadge, Alert, Button |
| 延滞判定結果確認画面 | /staff/overdues/judge | PortalShell, LoanTable, LoanStatusBadge, Alert, Button |
| 延滞状況一覧画面 | /staff/overdues | PortalShell, LoanTable, DueDateIndicator, LoanStatusBadge, Pagination, EmptyState |
| 督促送信画面 | /staff/overdues/dun | PortalShell, NotificationLogTable, NotificationStatusBadge, Alert, Button |
| 取置き対象者特定画面 | /staff/holds/next | PortalShell, ReservationQueueTracker, ReservationStatusBadge, UserProfileCard, Button |
| 取置き通知送信画面 | /staff/holds/notify | PortalShell, NotificationLogTable, NotificationStatusBadge, Alert, Button |
| 在庫状況集計条件指定画面 | /staff/reports/inventory/new | PortalShell, ReportPeriodSelector, ReportStatusBadge, Button |
| 在庫状況レポート画面 | /staff/reports/inventory | PortalShell, ReportKpiCard, LoanTrendChart, Table, BookStatusBadge, ReportStatusBadge, EmptyState |
| 集計期間指定画面 | /staff/reports/loans/new | PortalShell, ReportPeriodSelector, ReportStatusBadge, Button, Alert |
| 貸出統計レポート画面 | /staff/reports/loans | PortalShell, ReportKpiCard, LoanTrendChart, Table, ReportStatusBadge, EmptyState |

## State Mapping

### 書籍状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 在庫あり | 在庫あり | green | 司書: 貸出を登録する / 書籍情報を編集する / 書籍を削除する, 利用者: 在庫状況を確認する（予約は不可: 在庫あり書籍予約不可ポリシー） |
| 貸出中 | 貸出中 | blue | 司書: 返却を登録する, 利用者: 予約を登録する |
| 予約待ち | 予約待ち | amber | 司書: 予約順1位の利用者へ貸出を登録する / 取置き通知メールを送信する, 利用者: 取置き状況を照会する / 予約を取り消す |

### 貸出状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 貸出中 | 貸出中 | blue | 司書: 返却を登録する / 返却期限接近の貸出を判定する, 利用者: 自分の貸出内容と返却期限を照会する |
| 延滞 | 延滞 | red | 司書: 督促メールを送信する / 返却を登録する, 利用者: 自分の延滞中の貸出を照会する |
| 返却済み | 返却済み | gray | 司書: 貸出統計の集計対象として参照する, 利用者: 自分の貸出履歴を照会する |

### 予約状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 予約中 | 予約中 | blue | 司書: 予約順1位の利用者を特定する, 利用者: 自分の予約順位を照会する / 予約を取り消す |
| 取置き中 | 取置き中 | amber | 司書: 貸出を登録する / 取置き期限切れで取り消す, 利用者: 自分の取置き状況を照会する / 予約を取り消す |
| 貸出済み | 貸出済み | green | 司書: （終了。予約状況照会の対象外）, 利用者: 自分の貸出内容と返却期限を照会する |
| キャンセル | キャンセル | gray | 司書: 次順位者への取置きへ引き継ぐ, 利用者: （終了） |

### 利用者状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 登録済み | 登録済み | green | 司書: 利用者情報を編集する / 利用者を削除する / 貸出を登録する, 利用者: 自分の利用者情報を照会する |
| 取引進行中 | 取引進行中 | blue | 司書: 返却を登録する / 予約を取り消す（削除は不可）, 利用者: 自分の現在の貸出・予約状況を照会する |

### 通知状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 送信待ち | 送信待ち | amber | 司書: 送信を実行する |
| 送信済み | 送信済み | green | 司書: 送信実績として参照する（重複送信は抑止される） |
| 送信失敗 | 送信失敗 | red | 司書: 再送する / 未達として追跡する |

### 統計レポート状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 集計中 | 集計中 | violet | 司書: 集計完了を待つ |
| 作成済み | 作成済み | green | 司書: 在庫状況レポート／貸出統計レポートを参照する |
| 実績なし | 実績なし | gray | 司書: 集計期間を変更して再集計する |

## NFR Design Decisions

| NFR | Decision |
|-----|----------|
| F.1.1.2 対応ブラウザ Lv2（Chrome / Edge / Safari 最新版） | ベンダープレフィックスを前提にしない。CSS カスタムプロパティと flex/grid gap をそのまま使う |
| F.1.1.3 対応デバイス Lv2（PC + タブレット。スマホ要確認） | lg（12col / サイドバー展開）と md（8col / サイドバー 4rem 折りたたみ）をフル設計し、sm は崩れ防止の簡易対応に留める |
| F.3.1.2 アクセシビリティ Lv2（JIS X 8341-3:2016 AA 目標） | 本文コントラスト 4.5:1 以上、キーボード操作、aria 属性、色以外の手掛かり（アイコン/文言/dot）を全コンポーネントの既定要件にする。適合宣言は行わない |
| B.1.1.1 同時アクセス 〜100 / 登録利用者 〜1,000 | 仮想スクロールは導入せず、Pagination（20 件/頁）で一覧を分割する |
| B.2.1.1 レスポンスタイム 5 秒以内 | 全一覧・詳細コンポーネントに Skeleton のローディング状態を用意する |
| E.1.2.1 個人情報保護 / arch SR-006 個人情報表示の最小化 | UserProfileCard・UserTable・NotificationLogTable の連絡先を既定でマスクし、UserProfileCard のみ明示操作で開示できるようにする |
| E.5.3.1 司書向け機能は館内ネットワーク限定 | 司書ポータルを別プライマリ色（ティール）にし、公開ポータルとの取り違えを色でも防ぐ |
| A（可用性） / arch SP-004 本人限定参照の UI 制約 | 一覧系コンポーネントに EmptyState / Alert(destructive) / Skeleton の 3 状態を必須の Story として定義し、利用者ポータルには他利用者データへの導線を置かない |
| arch SR-002 冪等キーの付与と二重送信防止 | Button に loading 状態を持たせ、送信中は disabled かつ aria-busy にする |
| B.2.1.1 レスポンスタイム 5 秒以内 / F.3.1.2 アクセシビリティ Lv2 | loading 表現を LoadingState 1 か所に集約し、形が決まっている領域は Skeleton（list/card/detail/line）、レイアウトが変わらない待ちは Spinner（inline/overlay）に固定する。画面側に独自 loading UI を作らせず、常に aria-busy と読み上げラベルを伴わせる |
| E.5.3.1 司書向け機能は館内ネットワーク限定 / arch SP-004 本人限定参照の UI 制約 | URL の正本を routes.ts に一元化し、AppShell がポータル外・未登録ルートを描画しない。実装リポは router アダプタ（onNavigate）とページ本体だけを所有する |
| arch SR-004 日本語単一ロケール | i18n リソースバンドルは導入せず、日付・数値は toLocaleDateString('ja-JP') / toLocaleString('ja-JP') で書式化する |

## Storybook Page Stories

### 利用者ポータル (17画面)

| 画面 | UC | Story | Variants |
|------|---|-------|----------|
| 蔵書検索画面 | 書籍を検索する | Pages/利用者ポータル/蔵書検索画面 | Default, EmptyKeyword, Empty, SearchFailed |
| 書籍詳細・在庫状況画面 | 書籍詳細と在庫状況を照会する | Pages/利用者ポータル/書籍詳細・在庫状況画面 | Available, OnLoanWithReservation, Loading, NotFound |
| 書籍予約申込画面 | 予約を登録する | Pages/利用者ポータル/書籍予約申込画面 | OnLoan, AlreadyAvailable, AlreadyReserved, Loading |
| 予約取消受付画面 | 予約を取り消す | Pages/司書ポータル/予約取消受付画面 | Cancellable, NotCancellable, Loading, ErrorState |
| 予約順位確認画面 | 自分の予約順位を照会する | Pages/利用者ポータル/予約順位確認画面 | Waiting, OnHold, Loading, NotFound, ErrorState |
| 予約状況一覧画面 | 自分の予約状況を照会する | Pages/利用者ポータル/予約状況一覧画面 | Default, Loading, Empty, ErrorState, ManyPages |
| 取置き中予約確認画面 | 自分の取置き中の予約を照会する | Pages/利用者ポータル/取置き中予約確認画面 | Default, Loading, Empty, DeadlineToday, ErrorState |
| 取置き受取案内画面 | 自分の取置き状況を照会する | Pages/利用者ポータル/取置き受取案内画面 | Default, DeadlineToday, NotHoldingYet, Loading, NotFound |
| 現在の貸出一覧画面 | 自分の現在の貸出を照会する | Pages/利用者ポータル/現在の貸出一覧画面 | Default, Loading, Empty, Overdue, ErrorState, ManyPages |
| 貸出内容・返却期限確認画面 | 自分の貸出内容と返却期限を照会する | Pages/利用者ポータル/貸出内容・返却期限確認画面 | Safe, Near, Overdue, Loading, NotFound |
| 貸出履歴画面 | 自分の貸出履歴を照会する | Pages/利用者ポータル/貸出履歴画面 | Default, Loading, Empty, ErrorState, ManyPages |
| 返却期限リマインド確認画面 | 自分の返却期限を照会する | Pages/利用者ポータル/返却期限リマインド確認画面 | UpcomingReminder, DueToday, WithOverdueNotice, Loading, Empty |
| 延滞返却対象確認画面 | 自分の延滞中の貸出を照会する | Pages/利用者ポータル/延滞返却対象確認画面 | Default, Loading, Empty, ErrorState |
| 返却対象貸出確認画面 | 返却対象の貸出を照会する | Pages/利用者ポータル/返却対象貸出確認画面 | Default, Loading, Empty, OverdueFirst, ErrorState, ManyPages |
| 返却完了確認画面 | 自分の返却済み貸出を照会する | Pages/利用者ポータル/返却完了確認画面 | Default, Loading, Empty, OverdueReturn, ManyPages, ErrorState |
| マイページ登録内容画面 | 自分の利用者情報を照会する | Pages/利用者ポータル/マイページ登録内容画面 | Default, InTransaction, Loading, ErrorState |
| 利用者番号提示画面 | 利用者番号で貸出対象利用者を特定する | Pages/利用者ポータル/利用者番号提示画面 | Default, Loading, FetchFailed |

### 司書ポータル (24画面)

| 画面 | UC | Story | Variants |
|------|---|-------|----------|
| 蔵書管理台帳画面 | 蔵書一覧を照会する | Pages/司書ポータル/蔵書管理台帳画面 | Default, Loading, Empty, Error |
| 書籍受入登録画面 | 書籍を登録する | Pages/司書ポータル/書籍受入登録画面 | Default, ElectronicBookWarning, ValidationErrors, Submitting |
| 書誌情報訂正画面 | 書籍情報を編集する | Pages/司書ポータル/書誌情報訂正画面 | Default, Loading, ConflictError |
| 除籍手続画面 | 書籍を削除する | Pages/司書ポータル/除籍手続画面 | Deletable, NotDeletable, Loading |
| レファレンス検索画面 | 司書向けに蔵書を検索する | Pages/司書ポータル/レファレンス検索画面 | Default, Empty, SearchFailed |
| 利用者名簿画面 | 利用者一覧を照会する | Pages/司書ポータル/利用者名簿画面 | Default, Loading, Empty, ManyPages, ErrorState |
| 利用申込受付画面 | 利用者を登録する | Pages/司書ポータル/利用申込受付画面 | Default, ValidationErrors, Submitting, Registered |
| 利用者情報変更画面 | 利用者情報を編集する | Pages/司書ポータル/利用者情報変更画面 | Default, Loading, ConflictOnSave, ErrorState |
| 退会手続画面 | 利用者を削除する | Pages/司書ポータル/退会手続画面 | Deletable, NotDeletable, Loading, ErrorState |
| 貸出可否判定画面 | 書籍の貸出可否を判定する | Pages/司書ポータル/貸出可否判定画面 | Idle, Eligible, Ineligible, ValidationError, Submitting |
| 窓口貸出受付画面 | 貸出を登録する | Pages/司書ポータル/窓口貸出受付画面 | Default, Submitting, Success, Conflict, PeriodMismatch |
| 窓口返却受付画面 | 返却を登録する | Pages/司書ポータル/窓口返却受付画面 | Found, FindingLoading, NotFound, Overdue, Submitting, Success, AlreadyReturned |
| 返却後在庫整理画面 | 返却後の書籍状態を更新する | Pages/司書ポータル/返却後在庫整理画面 | NoReservation, WithReservation, Submitting, ResultInStock, ResultReserved, NotOnLoanError |
| 返却期限接近貸出一覧画面 | 返却期限接近の貸出を判定する | Pages/司書ポータル/返却期限接近貸出一覧画面 | Default, DueToday, Loading, Empty, ErrorState |
| リマインド送信画面 | リマインドメールを送信する | Pages/司書ポータル/リマインド送信画面 | Default, AllSent, Loading, Empty |
| 延滞判定結果確認画面 | 期限超過の貸出を延滞にする | Pages/司書ポータル/延滞判定結果確認画面 | Default, Empty, Loading, ErrorState |
| 延滞状況一覧画面 | 延滞中の貸出を照会する | Pages/司書ポータル/延滞状況一覧画面 | Default, WithDunFailures, Loading, Empty, ErrorState |
| 督促送信画面 | 督促メールを送信する | Pages/司書ポータル/督促送信画面 | Default, AllSent, Loading, Empty |
| 取置き対象者特定画面 | 予約順1位の利用者を特定する | Pages/司書ポータル/取置き対象者特定画面 | Default, NotEligible, NoCandidate, Loading, ErrorState |
| 取置き通知送信画面 | 取置き通知メールを送信する | Pages/司書ポータル/取置き通知送信画面 | WithFailures, NotSendable, AllSent, Loading |
| 在庫状況集計条件指定画面 | 在庫状況を区分別に集計する | Pages/司書ポータル/在庫状況集計条件指定画面 | Default, ValidationError, Submitting |
| 在庫状況レポート画面 | 在庫状況レポートを参照する | Pages/司書ポータル/在庫状況レポート画面 | Default, Aggregating, NoResult |
| 集計期間指定画面 | 期間別貸出統計を集計する | Pages/司書ポータル/集計期間指定画面 | Default, NoResultNotice, ValidationError |
| 貸出統計レポート画面 | 貸出統計レポートを参照する | Pages/司書ポータル/貸出統計レポート画面 | Default, Aggregating, NoResult |
