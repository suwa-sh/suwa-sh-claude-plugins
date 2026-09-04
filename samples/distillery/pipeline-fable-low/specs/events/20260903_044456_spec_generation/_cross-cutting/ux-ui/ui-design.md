# UI デザイン仕様

対象: 図書館蔵書管理システム（brand: Libro）
入力: design digest（brand / portals / screens / components / tokens / states / nfr_decisions）, NFR category-F
コンポーネント名・トークン名は design-event.yaml の名前をそのまま使う。

## レイアウトパターン

### 利用者（patron）ポータル

- **レイアウト構成**: ヘッダー（トップナビ）+ コンテンツ。サイドバーなし
- **ヘッダー**: 固定（topnav_height = 3.5rem）。左にロゴ（logo full / sm ではicon）、中央〜右にプライマリナビ 3 項目（蔵書検索 / マイ貸出履歴 / マイ予約状況）、右端にログイン状態
- **サイドバー**: なし
- **コンテンツエリア**: 最大幅 content_max_width（80rem）で中央寄せ。page_padding = spacing-6。検索結果は BookCard のグリッド（lg: 3 列 / md: 2 列 / sm: 1 列）
- **基調色**: primary = blue-600（Libro Blue）
- **PortalShell variant**: `patron`

### 司書（staff）ポータル

- **レイアウト構成**: サイドバー + ヘッダー + メイン
- **ヘッダー**: 固定（topnav_height = 3.5rem）。左にサイドバー折りたたみトグルとロゴ、右に操作者名（司書）とログアウト
- **サイドバー**: 折りたたみ可能（sidebar_width = 16rem / sidebar_collapsed_width = 4rem）。5 グループ（窓口 / 蔵書管理 / 利用者管理 / 予約・延滞状況 / 分析レポート）をグループ見出し + 項目（item_height = 2.5rem）で表示。アクティブ項目は active_bg / active_fg
- **コンテンツエリア**: 最大幅 content_max_width（80rem）。一覧はフル幅の Table、フォーム（BookForm / UserForm）は中央寄せ 8col、受付パネル（LoanRegisterPanel / ReturnRegisterPanel）は中央寄せ 8col
- **基調色**: primary = slate-700（Shelf Slate）
- **PortalShell variant**: `staff` / `staff-collapsed`

### 共通レイアウト要素

| 要素 | デザインシステムコンポーネント | 配置 |
|------|------------------------------|------|
| ポータル外枠（ヘッダー・ナビ・メイン） | PortalShell | 全画面 |
| プライマリナビ | PortalShell（patron: トップナビ / staff: サイドバー） | ヘッダー / サイドバー |
| アイコン | Icon（outlined / Lucide 準拠） | ナビ項目・ボタン・状態ドット |
| ページ見出し + 主要操作 | Button（default） | メイン上部（例: 蔵書一覧画面の「書籍を登録」） |
| 処理結果・警告 | Alert（info / success / warning / destructive） | メイン上部（見出し直下） |
| 一覧 | Table / BookTable / UserTable / LoanTable / ReservationTable / OverdueTable / NotificationLogTable | メイン |
| ページ送り | Pagination（default / single-page） | 一覧下部 |
| データなし | EmptyState（default / with-action） | 一覧・カードグリッドの代替 |
| 読み込み中 | Skeleton（line / table / card）/ Spinner | 一覧・カード・ボタン内 |
| 確認ステップ | ConfirmPanel（画面。Modal は本 event の UC では未使用。design の予備コンポーネント） | メイン（確認画面） |
| 集計値 | StatCard | メイン上部（分析レポート・延滞状況） |
| 期間指定 | PeriodSelector | StatCard の上 |
| 個人情報 | PiiMaskedText（email / phone / address） | Table セル・照会画面 |

## レスポンシブ戦略

### ブレイクポイント

design tokens `breakpoint`（sm 640 / md 768 / lg 1024 / xl 1280）を使う。NFR F.1.1.3（PC + タブレット、スマホ要確認）と design nfr_decisions に従い、lg / md をフル設計、sm は簡易対応とする。

| 名称 | 幅 | レイアウト変更 |
|------|---|-------------|
| Mobile（sm 未満） | < 640px | patron: トップナビをハンバーガーに畳み、BookCard 1 列。staff: サイドバーをオーバーレイ化（既定は閉）、Table は横スクロール。簡易対応（スマホ対応の要否は todo） |
| Tablet（sm〜lg 未満） | 640px - 1024px | patron: BookCard 2 列、トップナビは常時表示。staff: サイドバーは `staff-collapsed`（4rem、アイコンのみ）を既定にし、Table は列を優先度順に間引く（操作列・状態列は常時表示） |
| Desktop（lg 以上） | >= 1024px | patron: BookCard 3 列。staff: サイドバー展開（16rem）+ 全列表示。xl 以上ではコンテンツを content_max_width で中央寄せ |

### モバイル対応方針

- **ナビゲーション**: patron はハンバーガーメニュー（3 項目）、staff はオーバーレイサイドバー。タブバーは採用しない（司書機能は館内 PC 前提）
- **テーブル**: 横スクロール（先頭列を sticky）。BookCard を持つ利用者画面は最初からカード表示のため切替不要。LoanTable / ReservationTable（マイ画面）は sm で行を 2 段組みにし、状態バッジと期限を 1 段目に出す
- **フォーム**: BookForm / UserForm は 1 カラムのスタック表示。ステッパーは使わない（項目数 4〜6）
- **受付パネル**: LoanRegisterPanel / ReturnRegisterPanel は md 以上のみフル対応（窓口 PC 前提）
- **チャート**: PeriodStatChart は幅に追従し、sm では日次のバー本数を最大 31 本に制限してラベルを間引く
- **タッチ**: タップ領域 44px 以上。Button size は sm 以下で md 固定

## デザインシステムコンポーネント利用ガイドライン

### コンポーネント選定ルール

| 用途 | 推奨コンポーネント | 非推奨 | 理由 |
|------|-----------------|--------|------|
| 書籍の一覧（利用者） | BookCard（compact） | BookTable | 利用者は属性比較より発見が目的。カードで在庫状況と次の行動を並記できる |
| 書籍の一覧（司書） | BookTable（manage / inventory / select） | BookCard | 書籍の属性数 8 を比較・操作するにはテーブルが適切 |
| 状態の表示 | BookStatusBadge / LoanStatusBadge / ReservationStatusBadge | 素の Badge に文言を直書き | 状態モデルとの対応と色 + 文言の併記をドメインコンポーネントで保証する |
| 予約の進行 | ReservationQueueTracker | ReservationStatusBadge のみ | 順序性のある 3 状態と予約順位をステップで示す必要がある（利用者画面・書籍詳細・書籍別予約状況） |
| 返却期限 | DueDateIndicator | 日付テキストのみ | 残日数と ok / soon / overdue の強調を一貫させる |
| 検索条件 | BookSearchFilter（patron / staff） | Input + Select の個別配置 | 検索条件種別・ジャンル・在庫状況の切替を 1 コンポーネントで共通化する |
| 利用者検索（利用者一覧・照会） | Input（with-icon） | BookSearchFilter | 利用者は利用者番号・氏名の単一条件で足りる |
| 登録・編集 | BookForm / UserForm | 汎用フォームの都度実装 | 検証エラー（errors）と送信中（submitting）の扱いを統一する |
| 貸出・返却の受付 | LoanRegisterPanel / ReturnRegisterPanel | BookForm | 2 入力 → 判定 → 確定の専用フローで最少操作にする（SP-006） |
| 削除・取消・送信の確認 | ConfirmPanel（画面。Modal は本 event の UC では未使用） | Alert + Button の組合せ | 対象要約 + 影響 + 確定/戻る + submitting を一体で扱う（SR-005） |
| 個人情報の表示 | PiiMaskedText | プレーンテキスト | 既定マスクと明示開示を強制する（NFR E.1.2.1 / E.6.1.1） |
| 集計値 | StatCard | Table の 1 行 | 数値の視認性（value_size = 3xl）と前期比（delta）を統一する |
| 期間別推移 | PeriodStatChart | RankingList | 傾向は棒グラフ（Trend）で示す |
| ランキング | RankingList | PeriodStatChart | 順位付き比較（Comparison）は順位 + バーが読みやすい |
| 通知記録 | NotificationLogTable | Alert | 送信結果の履歴は一覧で残す |
| 空・読み込み | EmptyState / Skeleton | Spinner の単独表示（一覧） | レイアウトシフトを防ぎ、データなしには次の行動（with-action）を示す |
| 複数値の切替 | ToggleGroup（single） | Select | 3〜5 択（在庫状況・集計期間種別）は一覧性のあるトグルが速い |
| 多値の選択 | Select | ToggleGroup | ジャンル 8 値以上はセレクト |

### 状態表示パターン

状態モデル（状態.tsv）× design states × カラートークン。全状態で色 + 文言（+ dot）を併記する。

| 状態モデル | 状態 | 表示方法 | コンポーネント | カラートークン |
|-----------|------|---------|-------------|-------------|
| 書籍の状態 | 在庫あり | Badge（dot + 文言） | BookStatusBadge | success / success_light（green） |
| 書籍の状態 | 貸出中 | Badge（dot + 文言）+ 利用者には「予約できます」 | BookStatusBadge | info / info_light（blue） |
| 書籍の状態 | 予約待ち | Badge（dot + 文言）+ 予約順位 | BookStatusBadge + ReservationQueueTracker | pending / pending_light（orange） |
| 貸出の状態 | 貸出中 | Badge + 返却期限（残日数） | LoanStatusBadge + DueDateIndicator（ok / soon） | info / info_light（blue）、due_date.ok = success / due_date.soon = warning |
| 貸出の状態 | 延滞 | Badge + 期限超過日数 | LoanStatusBadge + DueDateIndicator（overdue） | destructive / destructive_light（red）、due_date.overdue = destructive |
| 貸出の状態 | 返却済み | Badge（neutral）+ 返却日 | LoanStatusBadge + DueDateIndicator（returned） | neutral / neutral_light（gray） |
| 予約の状態 | 予約中 | Badge + ステッパー（順位 / 総数） | ReservationStatusBadge + ReservationQueueTracker（waiting） | warning / warning_light（amber）、queue_tracker.current = primary |
| 予約の状態 | 通知済み | Badge + ステッパー（通知済みステップ）+ 「来館してください」 | ReservationStatusBadge + ReservationQueueTracker（notified） | analysis / analysis_light（violet） |
| 予約の状態 | 取消 | Badge（neutral）+ 取消日時 | ReservationStatusBadge + ReservationQueueTracker（cancelled） | neutral / neutral_light（gray） |
| 通知の送信結果 | 成功 / 失敗 / 送信待ち / 未送信 | テーブルセル内の文言 + アイコン | NotificationLogTable | success / destructive / warning / neutral |
| 貸出可否判定 | 可 / 否 | パネル内の判定結果 + 根拠 | LoanRegisterPanel（allowed / denied）+ Alert | success / destructive |
| 削除可否 | 可 / 不可 | 確認パネル（impact に根拠） | ConfirmPanel（destructive / blocked） | destructive / warning |

補足:
- 書籍の状態「貸出中」と貸出の状態「貸出中」はどちらも blue（info）を使い、画面上は主語（書籍 / 貸出）で区別する
- 予約の状態「予約中」（amber）と書籍の状態「予約待ち」（orange）は近い色相のため、同一画面（書籍別予約状況画面）ではバッジの文言で区別し、dot は必ず表示する
- 進行中（貸出中 / 予約中 / 通知済み）→ 終端（返却済み / 取消）は neutral に落として視覚的重みを下げる

## ダークモード対応方針

- **切替方式**: システム設定連動（prefers-color-scheme）を既定とし、PortalShell のヘッダーに手動切替を置く。選択はブラウザ永続化しない（arch SR-002 に従い設定値もセッション限り。個人情報ではないが永続化前提の UI を設けない方針に合わせる）
- **トークン戦略**: design tokens `dark_overrides` を使う。semantic 層（background / foreground / border / primary / success / warning / destructive / info / pending / analysis / neutral と各 _light）と component 層（card_bg / card_border / card_shadow / table_header_bg / sidebar_bg / modal_backdrop / pii_masked_bg / chart_grid）の上書きのみで対応し、コンポーネント側に色のハードコードを置かない
- **ポータル別 primary**: dark では patron = blue-500、staff = slate-400（primary_foreground は staff のみ gray-900）。staff のサイドバー背景は gray-950
- **注意事項**:
  - 状態バッジの `_light` 背景は rgba 半透明（例: success_light = rgba(22,163,74,0.18)）になるため、Table 行ホバー（hover_muted = gray-700）と重なってもコントラストを保つことを確認する
  - DueDateIndicator（overdue = red-400）と destructive ボタンの区別はアイコン + 文言で担保する
  - PeriodStatChart の bar は primary、grid は chart_grid（gray-700）。数値ラベルは foreground（gray-50）
  - Card の shadow は none にし、border（gray-700）で境界を示す
  - PiiMaskedText のマスク背景は pii_masked_bg（gray-700）、マスク文字は foreground_muted（gray-400）で「伏せている」ことが判別できるようにする
  - ロゴは currentColor の SVG（logo icon / full）を使い、dark 用画像を別途持たない
  - コントラスト比（AA）は light / dark 双方で検証する（Storybook addon-a11y）
