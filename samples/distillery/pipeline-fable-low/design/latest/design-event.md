# Design System: Libro

## Overview

| 項目 | 内容 |
|------|------|
| Event ID | 20260903_041812_design_system + 20260904_113742_spec_stories |
| Created At | 2026-09-04T11:37:42+09:00 (最終更新) |
| Source | dist-pipeline Step5 (design) / distillery:dist-design-system design_generation=required / dialogue_policy=auto_adopt + distillery:dist-spec-stories / storybook page story generation for all 24 tier-frontend screens |
| Portals | 2 |
| Components | 55 (UI: 15, Domain: 23, Common: 17) |
| Screens | 24 |
| Page Stories | 24 |

## Brand

- **Name**: Libro
- **Primary Color**: Libro Blue（利用者ポータル / ブランド基調色） (#2563EB)
- **Secondary Color**: Shelf Slate（司書ポータル） (#334155)
- **Sans Font**: Noto Sans JP, Inter, Hiragino Sans, Yu Gothic UI, system-ui, sans-serif
- **Mono Font**: JetBrains Mono, SFMono-Regular, Menlo, Consolas, monospace
- **Type Scale**: xs, sm, base, lg, xl, 2xl, 3xl
- **Tone**: 信頼・堅実。公共サービスとして丁寧だが冗長にしない。次に取る操作を必ず示す
- **Principles**: 利用者には状態と次の行動をセットで伝える（貸出中 → 予約できます）, 司書には判定結果と根拠を同時に示す（貸出できません: この書籍は貸出中です）, 個人情報は既定で伏せ、明示操作でのみ開示する（NFR E.1.2.1 / E.6.1.1）, 色だけで意味を伝えない。文言またはアイコンを必ず添える（JIS X 8341-3 AA 目標）, RDRA の業務用語をそのまま使う（在庫あり / 貸出中 / 予約待ち / 延滞 / 督促 / 返却通知）
- **Logo Variants**:
  - full: `assets/logo-full.svg`
  - icon: `assets/logo-icon.svg`
  - stacked: `assets/logo-stacked.svg`

## Portals

| ID | Name | Actor | Primary Color | Screen Count |
|-----|------|-------|:-------------:|:------------:|
| patron | 利用者ポータル | 利用者 | #2563EB | 6 |
| staff | 司書ポータル | 司書 | #334155 | 18 |

## Design Tokens

### Primitive

- **Color Scales**: white, black, gray, blue, slate, green, amber, orange, red, violet (10 scales)
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
- **ring**: var(--primary)
- **hover_muted**: var(--color-gray-200)
- **primary**: ポータル別: patron=var(--color-blue-600) / staff=var(--color-slate-700)
- **primary_hover**: ポータル別: patron=var(--color-blue-700) / staff=var(--color-slate-800)
- **primary_foreground**: var(--color-white)
- **primary_light**: ポータル別: patron=var(--color-blue-50) / staff=var(--color-gray-100)
- **success**: var(--color-green-600)
- **success_light**: var(--color-green-50)
- **warning**: var(--color-amber-600)
- **warning_light**: var(--color-amber-50)
- **destructive**: var(--color-red-600)
- **destructive_light**: var(--color-red-50)
- **info**: var(--color-blue-600)
- **info_light**: var(--color-blue-50)
- **pending**: var(--color-orange-600)
- **pending_light**: var(--color-orange-50)
- **analysis**: var(--color-violet-600)
- **analysis_light**: var(--color-violet-50)
- **neutral**: var(--color-gray-500)
- **neutral_light**: var(--color-gray-100)
- **page_padding**: var(--spacing-6)
- **section_gap**: var(--spacing-8)
- **component_gap**: var(--spacing-3)
- **card_padding**: var(--spacing-6)
- **sidebar_width**: 16rem
- **sidebar_collapsed_width**: 4rem
- **content_max_width**: 80rem
- **topnav_height**: 3.5rem

### Component

- **button**: height_sm, height_md, height_lg, padding_x, radius, font_size, font_weight
- **input**: height, padding_x, radius, border, bg, focus_ring
- **card**: bg, border, shadow, padding, radius
- **badge**: height, padding_x, radius, font_size, font_weight
- **table**: header_bg, row_height, cell_padding, border, row_hover
- **sidebar**: width, collapsed_width, bg, item_height, active_bg, active_fg
- **modal**: backdrop, radius, padding, shadow, width_sm, width_md
- **due_date**: ok, soon, overdue
- **queue_tracker**: done, current, todo
- **stat_card**: value_size, label_color
- **chart**: bar, bar_muted, grid
- **pii**: masked_color, masked_bg

### Dark Mode Overrides

**Semantic overrides:**

- **background**: var(--color-gray-900)
- **background_subtle**: var(--color-gray-800)
- **background_muted**: var(--color-gray-700)
- **foreground**: var(--color-gray-50)
- **foreground_secondary**: var(--color-gray-300)
- **foreground_muted**: var(--color-gray-400)
- **foreground_inverse**: var(--color-gray-900)
- **border**: var(--color-gray-700)
- **border_strong**: var(--color-gray-600)
- **hover_muted**: var(--color-gray-700)
- **primary**: patron=var(--color-blue-500) / staff=var(--color-slate-400)
- **primary_hover**: patron=var(--color-blue-400) / staff=var(--color-slate-300)
- **primary_foreground**: patron=var(--color-white) / staff=var(--color-gray-900)
- **primary_light**: patron=rgba(59,130,246,0.18) / staff=rgba(148,163,184,0.18)
- **success**: var(--color-green-400)
- **success_light**: rgba(22, 163, 74, 0.18)
- **warning**: var(--color-amber-400)
- **warning_light**: rgba(217, 119, 6, 0.18)
- **destructive**: var(--color-red-400)
- **destructive_light**: rgba(220, 38, 38, 0.18)
- **info**: var(--color-blue-400)
- **info_light**: rgba(59, 130, 246, 0.18)
- **pending**: var(--color-orange-400)
- **pending_light**: rgba(234, 88, 12, 0.18)
- **analysis**: var(--color-violet-400)
- **analysis_light**: rgba(124, 58, 237, 0.18)
- **neutral**: var(--color-gray-400)
- **neutral_light**: rgba(148, 163, 184, 0.16)

**Component overrides:**

- **card_bg**: var(--color-gray-800)
- **card_border**: var(--color-gray-700)
- **card_shadow**: none
- **table_header_bg**: var(--color-gray-800)
- **sidebar_bg**: var(--color-gray-950)
- **modal_backdrop**: rgba(2, 6, 23, 0.7)
- **pii_masked_bg**: var(--color-gray-700)
- **chart_grid**: var(--color-gray-700)

## Components

### UI Components

| Name | Variants | Sizes |
|------|----------|-------|
| Button | default, secondary, outline, ghost, destructive | sm, md, lg |
| Badge | default, success, warning, destructive, info, pending, analysis, neutral, outline | - |
| Card | default, hoverable, flush | - |
| Input | default, with-icon, error, disabled | - |
| Select | default, error, disabled | - |
| ToggleGroup | single, multi | sm, md |
| Table | default, empty, loading | - |
| Alert | info, success, warning, destructive | - |
| EmptyState | default, with-action | - |
| Skeleton | line, table, card | - |
| Spinner | - | sm, md, lg |
| Pagination | default, single-page | - |
| Modal | confirm, destructive-confirm | sm, md |
| Icon | outlined | - |
| PortalShell | patron, staff, staff-collapsed | - |

### Domain Components

| Name | Description | Screens |
|------|-------------|---------|
| BookStatusBadge | 書籍の状態（在庫あり / 貸出中 / 予約待ち）を色 + 文言で示す。状態.tsv「書籍の状態」に対応 | 蔵書一覧画面, 蔵書検索画面, 書籍詳細・在庫状況画面, 窓口蔵書検索画面, 在庫状況一覧画面, 貸出受付画面 |
| LoanStatusBadge | 貸出の状態（貸出中 / 延滞 / 返却済み）を示す。状態.tsv「貸出の状態」に対応 | マイ貸出履歴画面, 延滞・督促状況画面, 窓口利用状況照会画面, 返却受付画面 |
| ReservationStatusBadge | 予約の状態（予約中 / 通知済み / 取消）を示す。状態.tsv「予約の状態」に対応 | マイ予約状況画面, 書籍別予約状況画面, 予約取消画面, 窓口利用状況照会画面 |
| ReservationQueueTracker | 予約の進行（予約中 → 通知済み → 貸出完了）と予約順位をステップで示す。予約の状態は順序性があり状態数 3 のためトラッカー化 | マイ予約状況画面, 書籍詳細・在庫状況画面, 書籍別予約状況画面 |
| DueDateIndicator | 返却期限と残日数を表示し、リマインド日数以内は warning、期限超過は destructive で強調する。貸出.返却期限 + リマインド日数から導出 | マイ貸出履歴画面, 延滞・督促状況画面, 窓口利用状況照会画面, 貸出受付画面 |
| BookSearchFilter | 検索条件種別（キーワード / タイトル / 著者 / ISBN / ジャンル）を ToggleGroup で切り替え、ジャンルと在庫状況で絞り込む。バリエーション「検索条件種別」「ジャンル」に対応 | 蔵書検索画面, 窓口蔵書検索画面, 蔵書一覧画面 |
| BookCard | 利用者向けの書籍カード。タイトル / 著者 / ジャンル / 媒体種別 / 在庫状況を表示し、詳細へ遷移する | 蔵書検索画面, 書籍詳細・在庫状況画面, 予約申込画面 |
| BookTable | 司書向けの書籍一覧テーブル。書籍 ID / タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体 / 状態 / 操作列。情報「書籍」の属性数 8 でテーブル表示 | 蔵書一覧画面, 窓口蔵書検索画面, 在庫状況一覧画面 |
| BookForm | 書籍登録・編集フォーム。タイトル / 著者 / ISBN / 出版社 / ジャンル / 媒体種別（初期は紙固定）。中央寄せ 8col | 書籍登録画面, 書籍編集画面 |
| UserForm | 利用者登録・編集フォーム。氏名 / メールアドレス / 電話番号 / 住所。利用者番号は登録後にシステム採番 | 利用者登録画面, 利用者編集画面 |
| UserTable | 利用者一覧テーブル。利用者番号 / 氏名 / 連絡先（PiiMaskedText） / 登録日 / 操作列 | 利用者一覧画面 |
| PiiMaskedText | メールアドレス・電話番号・住所を既定でマスク表示し、目のアイコンで明示的に開示する。NFR E.1.2.1 / E.6.1.1 | 利用者一覧画面, 利用者編集画面, 窓口利用状況照会画面, 延滞・督促状況画面 |
| LoanTable | 貸出一覧テーブル。書籍 / 貸出日 / 返却期限（DueDateIndicator） / 状態（LoanStatusBadge）。利用者向けは本人分のみ | マイ貸出履歴画面, 窓口利用状況照会画面 |
| OverdueTable | 延滞中の貸出と督促送信状況を一覧表示。利用者 / 書籍 / 返却期限 / 延滞日数 / 最終督促日時 / 送信結果 | 延滞・督促状況画面 |
| NotificationLogTable | 通知（返却通知 / リマインド / 督促）の送信記録。通知種別 / 送信先 / 送信日時 / 送信結果 | 延滞・督促状況画面, 返却通知送信確認画面 |
| LoanRegisterPanel | 貸出受付。利用者番号と書籍 ID の 2 入力で貸出可否を判定し、返却期限の自動算出結果を表示して確定する。SP-006 最少操作 / SR-005 確認 + 二重送信防止 | 貸出受付画面 |
| ReturnRegisterPanel | 返却受付。書籍 ID から貸出を特定し、返却後の書籍状態（在庫あり / 予約待ち）と予約者の有無を表示して確定する | 返却受付画面, 返却通知送信確認画面 |
| ReservationTable | 書籍別の予約一覧。予約順位 / 利用者 / 受付日時 / 状態。司書は返却時の引き渡し先を把握する | 書籍別予約状況画面, マイ予約状況画面 |
| ConfirmPanel | 削除 / 取消 / 送信の確認ステップ。対象の要約 + 影響（例: 貸出中のため削除不可）+ 確定・戻るボタン。送信中は disabled | 書籍削除確認画面, 利用者削除確認画面, 返却通知送信確認画面, 予約取消画面 |
| StatCard | KPI カード。貸出件数 / 延滞件数 / 予約件数などの集計値とラベル、前期比 | 期間別貸出統計画面, 人気書籍ランキング画面, 在庫状況一覧画面 |
| RankingList | 貸出回数の多い順の書籍ランキング。順位 / 書籍 / ジャンル / 貸出回数バー | 人気書籍ランキング画面 |
| PeriodSelector | 集計期間種別（日 / 月 / 年）の切り替えと期間範囲の指定。バリエーション「集計期間種別」に対応 | 期間別貸出統計画面, 人気書籍ランキング画面 |
| PeriodStatChart | 期間別貸出件数の棒グラフ（SVG）。集計中は Skeleton、データなしは EmptyState | 期間別貸出統計画面 |

### Common Components

| Name | Description |
|------|-------------|
| PatronLayout | 利用者ポータル全画面の外枠。PortalShell（patron）にトップナビのアクティブ判定・認証ガード・ダークモード切替を付与する |
| StaffLayout | 司書ポータル全画面の外枠。PortalShell（staff / staff-collapsed）にサイドバーのアクティブ判定・折りたたみ状態・認証 + 司書区分ガードを付与する |
| PageHeader | 画面見出し + 主要操作 + 通知スロットを持つ共通ヘッダー。全 24 UC で使用 |
| AsyncStateView | ローディング（0.4 秒遅延つき Skeleton）/ エラー / 空状態 / コンテンツの表示切替を統一する |
| ErrorAlert | api client の統一エラー型を利用者/司書向け文言に変換して表示する（destructive / warning + 再試行） |
| NoticeAlert | 成功・完了通知を表示する（success トーン固定の Alert） |
| PaginatedListFrame | 一覧画面の filter / summary / content / pagination / loading / empty / error を統一するフレーム。20 件/頁固定 |
| KeywordSearchInput | Enter 送信・補助検証つきのキーワード検索入力（Input with-icon の合成） |
| ScopeToggle | 表示範囲（例: 現在 / 履歴、全件 / 延滞のみ）の切り替え。URL クエリ同期を付与する ToggleGroup 合成 |
| StatCardGroup | StatCard を横並びで表示する KPI カード群 |
| CollapsibleSection | 行展開などの折りたたみ表示（例: 延滞一覧の通知ログ展開） |
| EntityFormPage | 登録・編集フォーム画面の共通シェル（見出し + フォーム + 送信/キャンセル操作 + エラー表示） |
| ConfirmPage | 削除 / 取消 / 送信の確認ステップ画面の共通シェル。ConfirmPanel を包み、tone / blocked / submitting を統一する |
| SubmitButton | submitting 状態と連動する送信ボタン（Spinner 内包、二重送信防止） |
| BackLink | 前画面へ戻る ghost ボタン。検索条件・ページの復元を伴う画面遷移で使用 |
| CounterHandoffActions | 窓口業務（貸出/返却/予約状況）での次アクション導線ボタン群 |
| PeriodReportFrame | 集計期間選択 + レポート本体（グラフ/ランキング）+ ローディングを統一するフレーム |

## Screen Mapping

### 利用者ポータル (patron)

| Name | Route | Components |
|------|-------|------------|
| 蔵書検索画面 | /search | PortalShell, BookSearchFilter, BookCard, Pagination, EmptyState, Skeleton |
| 書籍詳細・在庫状況画面 | /books/:bookId | PortalShell, BookCard, BookStatusBadge, ReservationQueueTracker, Button, Alert |
| 予約申込画面 | /books/:bookId/reserve | PortalShell, BookCard, ReservationQueueTracker, ConfirmPanel, Alert |
| 予約取消画面 | /reservations/:reservationId/cancel | PortalShell, ReservationStatusBadge, ConfirmPanel |
| マイ貸出履歴画面 | /me/loans | PortalShell, LoanTable, DueDateIndicator, LoanStatusBadge, Pagination, EmptyState |
| マイ予約状況画面 | /me/reservations | PortalShell, ReservationTable, ReservationQueueTracker, ReservationStatusBadge, EmptyState |

### 司書ポータル (staff)

| Name | Route | Components |
|------|-------|------------|
| 蔵書一覧画面 | /staff/books | PortalShell, BookSearchFilter, BookTable, BookStatusBadge, Pagination, Button |
| 書籍登録画面 | /staff/books/new | PortalShell, BookForm, Button, Alert |
| 書籍編集画面 | /staff/books/:bookId/edit | PortalShell, BookForm, BookStatusBadge, Button |
| 書籍削除確認画面 | /staff/books/:bookId/delete | PortalShell, ConfirmPanel, BookStatusBadge |
| 窓口蔵書検索画面 | /staff/search | PortalShell, BookSearchFilter, BookTable, BookStatusBadge, Pagination |
| 利用者登録画面 | /staff/users/new | PortalShell, UserForm, Button, Alert |
| 利用者編集画面 | /staff/users/:userId/edit | PortalShell, UserForm, PiiMaskedText, Button |
| 利用者削除確認画面 | /staff/users/:userId/delete | PortalShell, ConfirmPanel, PiiMaskedText |
| 利用者一覧画面 | /staff/users | PortalShell, Input, UserTable, PiiMaskedText, Pagination, Button |
| 貸出受付画面 | /staff/loans/new | PortalShell, LoanRegisterPanel, BookStatusBadge, DueDateIndicator, Alert, Button |
| 返却受付画面 | /staff/returns/new | PortalShell, ReturnRegisterPanel, LoanStatusBadge, BookStatusBadge, Alert, Button |
| 返却通知送信確認画面 | /staff/returns/:loanId/notify | PortalShell, ConfirmPanel, ReservationTable, PiiMaskedText, NotificationLogTable |
| 書籍別予約状況画面 | /staff/books/:bookId/reservations | PortalShell, BookCard, ReservationTable, ReservationQueueTracker, ReservationStatusBadge |
| 延滞・督促状況画面 | /staff/overdues | PortalShell, StatCard, OverdueTable, DueDateIndicator, NotificationLogTable, Pagination |
| 窓口利用状況照会画面 | /staff/users/:userId/status | PortalShell, Input, PiiMaskedText, LoanTable, ReservationTable, LoanStatusBadge, ReservationStatusBadge |
| 在庫状況一覧画面 | /staff/reports/inventory | PortalShell, StatCard, ToggleGroup, BookTable, BookStatusBadge, Pagination |
| 人気書籍ランキング画面 | /staff/reports/ranking | PortalShell, PeriodSelector, RankingList, StatCard, Skeleton |
| 期間別貸出統計画面 | /staff/reports/loans | PortalShell, PeriodSelector, StatCard, PeriodStatChart, Skeleton |

## State Mapping

### 書籍の状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 在庫あり | 在庫あり | green | 司書: 貸出を登録する,書籍を編集する,書籍を削除する, 利用者: 書籍詳細を参照する |
| 貸出中 | 貸出中 | blue | 司書: 返却を登録する,書籍を編集する, 利用者: 予約を登録する |
| 予約待ち | 予約待ち | orange | 司書: 貸出を登録する（予約順位 1 位）,予約一覧を参照する, 利用者: 予約を取り消す |

### 貸出の状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 貸出中 | 貸出中 | blue | 司書: 返却を登録する, タイマー: リマインドを送信する,延滞を判定する |
| 延滞 | 延滞 | red | 司書: 返却を登録する,延滞一覧を参照する, タイマー: 督促を送信する |
| 返却済み | 返却済み | gray | 利用者: 貸出履歴を参照する |

### 予約の状態

| State | Label | Color | Actions |
|-------|-------|:-----:|---------|
| 予約中 | 予約中 | amber | 司書: 返却通知を送信する, 利用者: 予約を取り消す |
| 通知済み | 通知済み | violet | 司書: 貸出を登録する, 利用者: 予約を取り消す |
| 取消 | 取消 | gray | - |

## NFR Design Decisions

| NFR | Decision |
|-----|----------|
| B.1.1.1 同時アクセス数 〜100 / B.2.1.1 レスポンス 5 秒 | 仮想スクロールは採用せず、全一覧に 20 件/頁のページネーションと Skeleton を標準装備する |
| B.2.1.3 集計 10 秒以内 | 統計 3 画面は Skeleton + 「集計中」文言で待ち時間を可視化し、PeriodSelector 変更ごとに再集計する |
| E.1.2.1 / E.6.1.1 個人情報・貸出履歴の要配慮性 | 連絡先は PiiMaskedText で既定マスク。貸出履歴・予約状況は利用者ポータルでは本人分のみを前提に画面を構成する |
| E.5.3.1 利用制限（司書機能は館内限定） | PortalShell のナビをポータルごとに完全分離し、利用者ポータルに管理導線を一切出さない |
| arch SR-002 ブラウザ側に個人情報・認証情報を永続化しない | 「ログイン状態を保持」等の永続化を前提とする UI を設けない |
| arch SR-005 確認ステップとダブルサブミット防止 | 削除・貸出・返却・通知送信は ConfirmPanel / Modal を経由し、submitting 中はボタンを disabled + Spinner にする |
| F.1.1.3 対応デバイス Lv2（PC + タブレット、スマホ要確認 / confidence low） | lg / md をフル設計、sm はハンバーガー + 1 カラムの簡易対応。スマホ対応の要否は todo.md に登録 |
| F.3.1.2 アクセシビリティ JIS X 8341-3 AA 目標（confidence low） | コントラスト AA、色 + 文言/アイコン併用、focus-visible リング、prefers-reduced-motion 尊重。addon-a11y を有効化 |
| arch CTP-007 日本語のみ | i18n レイヤを設けず、ラベルは日本語リテラル。日付は YYYY/MM/DD 固定 |

## Storybook Page Stories

### 利用者ポータル (6画面)

| 画面 | UC | Story | Variants |
|------|---|-------|----------|
| 蔵書検索画面 | 書籍を検索する | Pages/利用者ポータル/蔵書検索画面 | Default, Empty, Loading |
| 書籍詳細・在庫状況画面 | 書籍詳細を参照する | Pages/利用者ポータル/書籍詳細・在庫状況画面 | Available, OnLoan, Reserved, Loading |
| 予約申込画面 | 予約を登録する | Pages/利用者ポータル/予約申込画面 | OnLoan, AlreadyAvailable, Submitting |
| 予約取消画面 | 予約を取り消す | Pages/利用者ポータル/予約取消画面 | Default, Submitting |
| マイ貸出履歴画面 | 貸出履歴を参照する | Pages/利用者ポータル/マイ貸出履歴画面 | Default, WithOverdue, Empty |
| マイ予約状況画面 | 予約状況を参照する | Pages/利用者ポータル/マイ予約状況画面 | Default, Notified, Empty |

### 司書ポータル (18画面)

| 画面 | UC | Story | Variants |
|------|---|-------|----------|
| 蔵書一覧画面 | 書籍一覧を参照する | Pages/司書ポータル/蔵書一覧画面 | Default, Empty, Loading |
| 書籍登録画面 | 書籍を登録する | Pages/司書ポータル/書籍登録画面 | Default, ValidationError, Submitting |
| 書籍編集画面 | 書籍を編集する | Pages/司書ポータル/書籍編集画面 | Default, Submitting |
| 書籍削除確認画面 | 書籍を削除する | Pages/司書ポータル/書籍削除確認画面 | Deletable, Blocked |
| 窓口蔵書検索画面 | 書籍を検索する | Pages/司書ポータル/窓口蔵書検索画面 | Default, Empty |
| 利用者登録画面 | 利用者を登録する | Pages/司書ポータル/利用者登録画面 | Default, ValidationError, Registered |
| 利用者編集画面 | 利用者を編集する | Pages/司書ポータル/利用者編集画面 | Default, Submitting |
| 利用者削除確認画面 | 利用者を削除する | Pages/司書ポータル/利用者削除確認画面 | Deletable, Blocked |
| 利用者一覧画面 | 利用者一覧を参照する | Pages/司書ポータル/利用者一覧画面 | Default, Empty, Loading |
| 貸出受付画面 | 貸出を登録する | Pages/司書ポータル/貸出受付画面 | Input, Allowed, Denied, Done |
| 返却受付画面 | 返却を登録する | Pages/司書ポータル/返却受付画面 | Input, Found, FoundWithReservation, Done |
| 返却通知送信確認画面 | 返却通知を送信する | Pages/司書ポータル/返却通知送信確認画面 | Default, Sent, Failed |
| 書籍別予約状況画面 | 予約一覧を参照する | Pages/司書ポータル/書籍別予約状況画面 | Default, Empty |
| 延滞・督促状況画面 | 延滞一覧を参照する | Pages/司書ポータル/延滞・督促状況画面 | Default, Empty, Loading |
| 窓口利用状況照会画面 | 利用者の利用状況を参照する | Pages/司書ポータル/窓口利用状況照会画面 | Default, NotFound |
| 在庫状況一覧画面 | 在庫状況一覧を参照する | Pages/司書ポータル/在庫状況一覧画面 | Default, Loading |
| 人気書籍ランキング画面 | 人気書籍ランキングを参照する | Pages/司書ポータル/人気書籍ランキング画面 | Default, Loading, Empty |
| 期間別貸出統計画面 | 期間別貸出統計を参照する | Pages/司書ポータル/期間別貸出統計画面 | Monthly, Daily, Loading |
