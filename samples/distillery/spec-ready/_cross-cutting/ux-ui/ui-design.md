# UI デザイン仕様

- system: 図書館蔵書管理システム（ブランド名 `Libra`）
- event_id: `20260902_152849_spec_generation`
- 正本: `docs/design/latest/design-event.yaml`（本書は `_digest/` の brand / portals / tokens / components / states / nfr_decisions を参照して記述する）
- 制約: ここに無いコンポーネント・トークン・状態を新規に定義しない。追加が必要なら design ステージへ差し戻す

## レイアウトパターン

両ポータルとも骨格は共通の `PortalShell`（`src/components/ui/PortalShell.tsx`）を使い、`data-portal` 属性で patron / staff を切り替える。

### 利用者ポータル（patron）

- **レイアウト構成**: サイドバー（`sidebar_width` 16rem）+ ヘッダー + メインコンテンツ
- **ヘッダー**: 固定（スクロール追従）。ロゴ（`logo-full`）・現在の業務名・ログイン利用者名を配置する
- **サイドバー**: 折りたたみ可能（`sidebar_collapsed_width` 4rem）。プライマリナビは 4 項目（蔵書をさがす / 予約 / 貸出 / マイページ）
- **コンテンツエリア**: 最大幅 `content_max_width` 80rem、中央寄せ、`page_padding` 1.5rem
- **アクセント**: `primary_patron`（`--color-blue-700` = `#1D4ED8`）
- **PortalShell バリアント**: `patron`

### 司書ポータル（staff）

- **レイアウト構成**: サイドバー 16rem + ヘッダー + メインコンテンツ（patron と同一骨格）
- **ヘッダー**: 固定。ロゴ（`logo-icon`）・業務名・ログイン司書名・館内ネットワーク接続であることの表示を配置する
- **サイドバー**: 折りたたみ可能。プライマリナビは 6 項目（蔵書管理 / 利用者管理 / 貸出・返却 / 期限・督促 / 予約・取置き / レポート）
- **コンテンツエリア**: 一覧・レポートは最大幅を解除してフル幅、フォーム・詳細は 80rem に収める
- **アクセント**: `primary_staff`（`--color-teal-700` = `#0F766E`）。公開ポータルとの取り違えを色でも防ぐ（NFR E.5.3.1 に対する design 決定）
- **PortalShell バリアント**: `staff`

### 共通レイアウト要素

| 要素 | デザインシステムコンポーネント | 配置 |
|------|------------------------------|------|
| ポータル骨格 | `PortalShell`（`patron` / `staff` / `collapsed`） | 全画面 |
| ロゴ・アイコン | `Icon`（Lucide 準拠 outlined 24x24 / currentColor） | ヘッダー・サイドバー |
| プライマリナビ | `PortalShell` 内のサイドバーナビ（業務単位） | サイドバー |
| 業務内サブ導線 | `Card` / `Button(outline)` | コンテンツエリア上部 |
| 一覧の分割 | `Pagination`（`default` / `single-page`、20 件/頁） | 一覧下部 |
| 読み込み中 | `Skeleton`（`line` / `table`） | コンテンツエリア |
| 0 件表示 | `EmptyState`（`default` / `with-action`） | コンテンツエリア |
| 業務メッセージ | `Alert`（`info` / `success` / `warning` / `destructive`） | コンテンツエリア上部 |
| 確認ダイアログ | `Modal`（`confirm` / `destructive-confirm`、`sm` 24rem / `md` 32rem） | オーバーレイ |

## レスポンシブ戦略

NFR F.1.1.3（対応デバイス Lv2: PC + タブレット）に対する design 決定に従い、`lg` と `md` をフル設計し、`sm` は崩れ防止の簡易対応に留める。

### ブレイクポイント

トークン `breakpoint` を正本とする。

| 名称 | 幅 | レイアウト変更 |
|------|---|-------------|
| Mobile（sm 未満） | < 640px | 簡易対応。サイドバーはドロワー化、`grid_columns` を 4 相当に縮退、テーブルは横スクロール。崩れ防止が目的で最適化はしない |
| Small（sm） | 640px - 767px | Mobile と同一（ドロワー + 横スクロール、`grid_columns` 4 相当）。sm 帯専用のレイアウトは持たない |
| Tablet（md） | 768px - 1023px | 8 カラム相当。サイドバーは `collapsed`（4rem、アイコンのみ）。KPI カードは 2 列、フォームは 1 列にスタック |
| Desktop（lg 以上） | ≥ 1024px | 既定。`grid_columns` 12、サイドバー展開（16rem）。KPI カードは 4 列、フォームは 2 列 |
| Wide（xl） | ≥ 1280px | Desktop と同一。コンテンツは `content_max_width` 80rem で中央寄せ（一覧・レポートを除く） |

### モバイル対応方針

- **ナビゲーション**: `lg` 以上は常設サイドバー、`md` は `PortalShell` の `collapsed`（アイコンのみ）、`sm` 未満はハンバーガーからのドロワー。タブバーは使わない
- **テーブル**: `md` 以上は通常表示。`sm` 未満は横スクロール（`Table` の親を `overflow-x`）。カード表示への切替は行わない（設計・実装の二重化を避ける）
- **フォーム**: `lg` は 2 列、`md` 以下は 1 列にスタックする。ステッパーは使わず 1 画面 1 フォームを維持する
- **タップ領域**: 主要操作は `button.height_lg` 2.75rem 以上を確保する。館内タブレットでの窓口業務（貸出・返却受付）を主対象とする
- **利用者番号提示画面**（`/mypage/card`）は例外的に `sm` を主対象とし、利用者番号を `font_size.3xl` の等幅（`font_family.mono`）で表示する

## デザインシステムコンポーネント利用ガイドライン

### コンポーネント選定ルール

| 用途 | 推奨コンポーネント | 非推奨 | 理由 |
|------|-----------------|--------|------|
| 書籍 1 件の提示（利用者向け） | `BookCard` | `Table` | 書影相当の視認性とジャンル・状態を並置でき、非熟練利用者の走査に適する |
| 書籍の一覧（司書向け） | `Table` + `BookStatusBadge` | `BookCard` | 台帳・レファレンスは項目比較が目的。1 画面あたりの件数を優先する |
| 貸出の一覧 | `LoanTable` | 素の `Table` | `showUser` で司書 / 利用者の列構成を切り替え、default / loading / empty / error の 4 状態を持つため |
| 利用者の一覧 | `UserTable` | 素の `Table` | 連絡先の常時マスクと削除可否の読み取りが組み込まれている（NFR E.1.2.1） |
| 利用者 1 件の提示 | `UserProfileCard` | `Card` 直書き | `maskContact` による既定マスクと明示開示（`revealed`）が組み込まれている |
| 返却期限の表現 | `DueDateIndicator` | `Badge` のみ | 残日数・超過日数を数値と文言で示し、色に依存しない |
| 予約の進行状況 | `ReservationQueueTracker` | `Pagination` / 素の `Badge` | 順位と段階（予約中 → 取置き中 → 貸出済み）を同時に伝える |
| 取置きの受取案内 | `HoldPickupCard` | `Alert` | 利用者番号の大きな提示と取置き期限の強調が目的 |
| 通知の送信実績 | `NotificationLogTable` | 素の `Table` | 送信失敗行の再送操作と未達件数の警告が組み込まれている |
| レポートの主要指標 | `ReportKpiCard` | `Card` 直書き | 値の等幅・桁揃えと前期比の増減表示を統一する |
| レポートの推移表示 | `LoanTrendChart` | 外部チャートライブラリ | SVG/div 実装で `aria-label` のテキスト代替を保証済み。外部依存を増やさない |
| 集計条件の指定 | `ReportPeriodSelector` | `Input` の組み合わせ | レポート種別・集計期間区分の RDRA バリエーションに束縛される |
| 検索条件の指定 | `BookSearchFilter` | `Input` の組み合わせ | 検索条件種別・ジャンル・資料種別のトグルと結果件数表示が一体化している |
| 破壊的操作の確認 | `Modal(destructive-confirm)` | `Alert` / `window.confirm` | フォーカストラップと Esc クローズを備え、対象名を再掲できる |
| 単一選択・複数選択 | `ToggleGroup`（`single` / `multi`） | セレクトボックス | RDRA バリエーションの値が 3〜8 件で、選択肢を露出したほうが誤選択が減る |
| 0 件の表示 | `EmptyState` | 空の `Table` | 「なぜ 0 件か」と次の行動を提示するため |
| 読み込み中の表示 | `Skeleton` | スピナー単独 | レイアウトシフトを避け、ドハティの閾値に対する体感を改善する |

補足ルール:

- `Badge`（UI）を状態表示に直接使わない。必ず状態別のドメインバッジ（`BookStatusBadge` 等）を経由し、マッピングは `stateMaps`（`src/components/domain/stateMaps.ts`）を正本とする。ここに無い状態を追加してはならない
- 一覧系（`LoanTable` / `UserTable` / `NotificationLogTable` / `Table`）は `EmptyState` / `Alert(destructive)` / `Skeleton` の 3 状態を必ず実装する
- `Button` は送信中に `loading` とし、`disabled` かつ `aria-busy` にする（arch SR-002 冪等キー / 二重送信防止）
- 破壊的操作の `Button` は `destructive`、主操作は `default`、副次操作は `outline`、ナビ的操作は `ghost` に固定する

### 状態表示パターン

RDRA 状態モデル 6 種を design の `states` に従って表示する。

| 状態モデル | 表示方法 | コンポーネント | カラートークン |
|-----------|---------|-------------|-------------|
| 書籍状態: 在庫あり | Badge（dot + 文言） | `BookStatusBadge` | `success`（`--color-green-600`） |
| 書籍状態: 貸出中 | Badge（dot + 文言） | `BookStatusBadge` | `info`（`--color-blue-600`） |
| 書籍状態: 予約待ち | Badge（dot + 文言） | `BookStatusBadge` | `warning`（`--color-amber-600`） |
| 貸出状態: 貸出中 | Badge + 残日数 | `LoanStatusBadge` + `DueDateIndicator` | `info` / `duedate.safe_color` |
| 貸出状態: 延滞 | Badge + 超過日数 | `LoanStatusBadge` + `DueDateIndicator` | `destructive`（`--color-red-600`） / `duedate.over_color` |
| 貸出状態: 返却済み | Badge | `LoanStatusBadge` | `neutral`（`--color-gray-500`） |
| 予約状態: 予約中 | ステッパー（1/3）+ Badge | `ReservationQueueTracker` + `ReservationStatusBadge` | `info` / `queue.active_bg` |
| 予約状態: 取置き中 | ステッパー（2/3）+ Badge + 期限 | `ReservationQueueTracker` + `HoldPickupCard` | `warning` / `queue.active_bg` |
| 予約状態: 貸出済み | ステッパー（3/3）+ Badge | `ReservationQueueTracker` | `success` / `queue.done_bg` |
| 予約状態: キャンセル | Badge（中立表示） | `ReservationStatusBadge` | `neutral` |
| 利用者状態: 登録済み | Badge | `UserStatusBadge` | `success` |
| 利用者状態: 取引進行中 | Badge + 削除不可の根拠 | `UserStatusBadge` + `Alert(warning)` | `info` |
| 通知状態: 送信待ち | Badge | `NotificationStatusBadge` | `warning` |
| 通知状態: 送信済み | Badge | `NotificationStatusBadge` | `success` |
| 通知状態: 送信失敗 | Badge + 再送ボタン | `NotificationStatusBadge` + `Button(outline)` | `destructive` |
| 統計レポート状態: 集計中 | Badge + Skeleton | `ReportStatusBadge` + `Skeleton` | `analysis`（`--color-violet-600`） |
| 統計レポート状態: 作成済み | Badge | `ReportStatusBadge` | `success` |
| 統計レポート状態: 実績なし | Badge + EmptyState | `ReportStatusBadge` + `EmptyState` | `neutral` |

いずれのバッジも `dot`（色）だけでなく状態名の文言を必ず伴う。色のみで意味を伝えない（JIS X 8341-3 AA 目標 / NFR F.3.1.2）。

### 日付・期限の表示規約（全 UC 共通の唯一の正本）

API 上の日付形式と画面上の表示形式を明確に分け、仕様例・BDD・UI 実装が同じ文字列を使う。

| 層 | 形式 | 例 | 備考 |
|----|------|---|------|
| API（`openapi.yaml` の `format: date`） | ISO 8601 `YYYY-MM-DD` | `2026-09-16` | 送受信・比較・保存はこの形式だけを使う |
| API（`format: date-time`） | ISO 8601（UTC オフセット付き） | `2026-09-16T09:00:00+09:00` | 取置き期限・送信日時 |
| 画面表示（日付） | `YYYY年M月D日` | `2026年9月16日` | `toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })` |
| 画面表示（日時） | `YYYY年M月D日 HH:mm` | `2026年9月16日 09:00` | 分まで表示し、秒は表示しない |
| 画面表示（テーブルの列） | `YYYY/MM/DD` | `2026/09/16` | 桁揃えが必要な一覧のみ。ヘッダーに単位を書かない |

**残日数・超過日数の文言**（`DueDateIndicator` および返却期限を扱う全画面）:

| 状態 | 条件 | 文言 | variant |
|------|------|------|---------|
| safe | 残り 4 日以上 | `あと{N}日` | `safe` |
| near | 残り 1〜3 日 | `あと{N}日` | `near` |
| due-today | 当日 | `本日が返却期限` | `near` |
| overdue | 期限超過 | `{N}日超過` | `over` |

期限の種別が返却期限でない場合は、当日文言だけを種別名へ差し替える（残日数・超過の書式は共通）。

| 期限の種別 | 当日文言 | 適用画面 |
|---|---|---|
| 返却期限（`loans.due_date`） | `本日が返却期限` | 貸出・返却・リマインド・督促の各画面 |
| 取置き期限（`reservations.hold_expires_at`） | `本日が受取期限` | 取置き状況・取置き中の予約の各画面 |

- 残日数は「返却期限 − 本日」の**日数差**（時刻を切り捨てた暦日差）で算出する。
- 「残り {N} 日」「{N} 日後」などの別表記は使わない。**`あと{N}日` に統一**する。
- 日付と残日数は必ず併記する（例: `2026年9月16日（あと14日）`）。色だけで期限の近さを伝えない。
- BDD シナリオの期待値も本表の文字列をそのまま書く（表示テストと UI 実装が同じ文字列を参照するため）。

### トークン利用ルール

- 画面・コンポーネントの実装では **semantic 層と component 層のトークンだけ**を参照する。primitive の値（`#1D4ED8` 等）を直接書かない
- ポータル色は `primary_patron` / `primary_staff` を `PortalShell` の `data-portal` から解決する。画面側でポータル色をハードコードしない
- 余白は `page_padding` / `section_gap` / `component_gap` / `card_padding` を使う。任意の px 値を使わない
- アニメーションは `duration.fast` 120ms（ホバー・フォーカス）、`normal` 200ms（開閉）、`slow` 320ms（Modal）に限定する。`prefers-reduced-motion: reduce` では無効化する
- グリッドは `grid_columns` 12 を基準とし、`md` で 8 相当、`sm` 未満で 4 相当に縮退する

## ダークモード対応方針

- **切替方式**: 両方（システム設定連動を既定とし、手動切替も提供する）。`prefers-color-scheme` と `.dark` クラスの両対応（design の `storybook.globals.theme` に一致）。手動選択はブラウザローカルに保持し、サーバ側の利用者情報には保存しない（RDRA の利用者属性に無いため）
- **トークン戦略**: `tokens.dark_overrides` を正本とする。semantic 15 項目（background 系 / foreground 系 / border 系 / hover・active / `*_light` 7 種 / `primary_patron` `primary_staff`）と component 18 項目（card / input / table / sidebar / modal / skeleton / duedate / queue / chart / pii）のみを上書きする。画面側で個別に色を再定義しない
- **ポータル色**: ダークでは `primary_patron` を `--color-blue-400`、`primary_staff` を `--color-teal-400` に切り替える。暗背景でのコントラストを確保しつつ、ポータルの識別性（青 / ティール）は維持する
- **注意事項**:
  - 状態色の背景は不透明色でなく `*_light`（rgba 18% のオーバーレイ）を使い、暗背景で沈まないようにする
  - `DueDateIndicator` の 3 段階（safe / near / over）と `LoanTrendChart` の棒・グリッドは、ライト・ダークの両方でコントラスト 3:1 以上を検証する
  - 個人情報のマスク（`pii.mask_bg`）はダークで `--color-gray-800`。マスク済みであることが背景に紛れないよう、マスク文字（`pii.mask_color`）とのコントラストを確保する
  - `Modal` のバックドロップはダークで `rgba(2, 6, 23, 0.7)`。ライトの 0.45 より濃くし、背面の可読要素を確実に落とす
  - `shadow` はダークで視認性が下がるため、`card_shadow` の差し替えに加えて `card_border`（`--color-gray-700`）で境界を担保する
  - スクリーンショットベースの視覚回帰は light / dark × patron / staff の 4 組み合わせで取得する
