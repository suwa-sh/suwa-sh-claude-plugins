# 利用者一覧を照会する - 司書ポータル仕様

## 変更概要

司書ポータル（`tier-frontend-staff`）に利用者名簿画面を追加し、利用者一覧の取得・絞り込み・ページングと、連絡先の常時マスク表示を実装する。行から利用申込受付・利用者情報変更・退会手続へ遷移する導線を提供する。

## 画面仕様

### 利用者名簿画面

- **URL**: `/staff/users`
- **アクセス権**: 司書（役割「司書」のトークンを持つ場合のみ表示。実際のアクセス制御は API Gateway の RBAC とバックエンド API が担保する / LP-029）
- **ポータル**: `staff`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`staff`） | サイドバー「利用者管理」を選択状態にする |
| 利用者区分フィルター | フォーム | `ToggleGroup`（`single` / `sm`） | 一般 / 学生 / 団体。未選択で全件 |
| 利用者一覧 | テーブル | `UserTable` | 連絡先を常時マスクし、進行中の貸出・予約件数から削除可否を読み取れる |
| 利用者状態 | バッジ | `UserStatusBadge` | 登録済み / 取引進行中。`dot` と状態名の文言を併記する |
| ページング | ナビゲーション | `Pagination`（`default` / `single-page`） | 20 件/頁。無限スクロールは使わない |
| 0 件表示 | 空状態 | `EmptyState`（`with-action`） | 「該当する利用者はいません」＋絞り込み解除 |
| 読み込み中 | プレースホルダ | `Skeleton`（`table`） | 応答が 0.4 秒を超える可能性があるため表示する |
| 取得失敗 | メッセージ | `Alert`（`destructive`） | 再試行ボタンを同じ位置に置く |
| 利用者を登録する導線 | ボタン | `Button`（`default`） | `/staff/users/new` へ遷移 |
| 利用者情報を編集する導線 | ボタン | `Button`（`outline`） | `/staff/users/:userNumber/edit` へ遷移 |
| 退会手続導線 | ボタン | `Button`（`destructive`） | `/staff/users/:userNumber/withdraw` へ遷移。進行中取引があるときは非表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| ポータルアクセント | `var(--primary)` | `var(--color-teal-700)`（`#0F766E`） |
| テーブルヘッダー背景 | `var(--table-header-bg)` | `var(--color-gray-50)` |
| 行ホバー背景 | `var(--table-row-hover-bg)` | `var(--hover-muted)` |
| 個人情報マスク背景 | `var(--pii-mask-bg)` | ダークでは `var(--color-gray-800)` |
| ページ余白 | `var(--page-padding)` | `var(--spacing-6)` |
| セクション間隔 | `var(--section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 検索条件（キーワード・利用者区分・頁）と取得結果を状態管理層（`L-frontend-staff-state`）で保持する。窓口フローで引き継ぐ利用者番号もここで保持し、登録・編集・削除の完了後は利用者一覧のキャッシュを無効化して再取得する（LP-030）。
- **バリデーション**: 利用者区分は RDRA バリエーションの値（一般 / 学生 / 団体）のみを選択肢に出し、自由入力を許可しない。キーワードは最大 100 文字。
- **ローディング**: 取得中は `Skeleton`（`table`）を表示する。フィルター変更時も同じ扱いにする。
- **エラーハンドリング**: API クライアント層が分類したエラーを状態管理層で集約し（CLP-014）、ビュー層は `Alert(destructive)` に平易な日本語で表示する。内部 ID・スタックトレースは表示しない。
- **アクセシビリティ**: 表に `caption`「利用者名簿」と `th scope="col"` を付与する。件数の更新は `aria-live="polite"` で通知する。

#### 操作フロー

1. 司書がサイドバー「利用者管理」から利用者名簿画面を開く。
2. 状態管理層が `GET /api/v1/users?page=1&per_page=20` を要求する。
3. 取得中は `Skeleton` を表示し、完了後に `UserTable` を描画する。
4. 司書が利用者区分の `ToggleGroup` を操作すると頁を 1 に戻して再取得する。
5. 司書が `Pagination` で頁を切り替えると当該頁を再取得する。
6. 司書が行の操作ボタンから利用申込受付・利用者情報変更・退会手続へ遷移する。

## コンポーネント設計

### UserTable（利用者名簿画面での利用）

- **ベースコンポーネント**: `UserTable`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | users | UserSummary[] | Yes | 利用者番号・氏名・マスク済み連絡先・利用者区分・利用者状態・進行中貸出件数・進行中予約件数 |
  | loading | boolean | Yes | 取得中は `Skeleton` を表示する |
  | error | string \| null | No | 取得失敗時のメッセージ |
  | actionsFor | (user: UserSummary) => Action[] | No | 進行中取引が 0 件のときだけ退会手続アクションを返す |
- **状態**: `default` / `loading` / `empty` / `error`
- **イベント**: なし（デザインシステムの `UserTable` の props は `users` / `loading` / `error` / `actionsFor` のみで `onSelect` を持たない。行からの遷移は `actionsFor` が返す `Action` 経由で行い、利用者番号を状態管理層へ引き継ぐ。`onSelect` を直接使いたい場合はデザインシステム側への追加が必要。`LoanTable` は `onSelect` を持つため、同じ表形式でも扱いが異なる）

### UserStatusBadge（一覧行での利用）

- **ベースコンポーネント**: `UserStatusBadge`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | "登録済み" \| "取引進行中" | Yes | 利用者状態。`stateMaps` のマッピングを正本とする |
  | dot | boolean | No | 色ドットの表示。文言は常に併記する |
- **状態**: 登録済み（`success`） / 取引進行中（`info`）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 利用者一覧を照会する - 司書ポータル

  Scenario: 一覧が 20 件/頁で描画される
    Given バックエンド API が利用者 25 件のうち 1 頁目 20 件を返すようスタブされている
    When 司書が利用者名簿画面（/staff/users）を表示する
    Then UserTable に 20 行が描画される
    And Pagination に「1 / 2」が表示される

  Scenario: 連絡先が既定でマスクされる
    Given バックエンド API が利用者「田中太郎 / tanaka@example.com」を返すようスタブされている
    When 司書が利用者名簿画面を表示する
    Then 連絡先列に「tanaka@example.com」がそのまま表示されない
    And マスク表示（例「t****@example.com」）が表示される

  Scenario: 利用者区分の絞り込みで頁が 1 に戻る
    Given 司書が利用者名簿画面の 2 頁目を表示している
    When 司書が利用者区分「学生」を選択する
    Then GET /api/v1/users?user_category=学生&page=1&per_page=20 が呼ばれる
    And Pagination の現在頁が 1 になる

  Scenario: 0 件のとき空状態を表示する
    Given バックエンド API が items 0 件・total 0 を返すようスタブされている
    When 司書が利用者区分「団体」で絞り込む
    Then EmptyState に「該当する利用者はいません」が表示される
    And 絞り込みを解除するボタンが表示される

  Scenario: 取得失敗時にエラーと再試行を表示する
    Given バックエンド API が HTTP 500 を返すようスタブされている
    When 司書が利用者名簿画面を表示する
    Then Alert(destructive) が表示される
    And 再試行ボタンが表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | UserTable の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `DataListSection` | `@/components/common/DataListSection` | 「フィルター → 一覧 → ページ送り」の縦積み（UserTable（Domain） + `Pagination` 20 件/頁） |
| `FilterPanel` | `@/components/common/FilterPanel` | 表示要素「利用者区分フィルター」（`ToggleGroup(single)`） の内側で使う（置き換えない） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | UserTable 行の連絡先列 |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"full"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← UserTable の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"table"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `DataListSection` | `filter` ← 表示要素「利用者区分フィルター」（`ToggleGroup(single)`） / `table` ← UserTable（Domain） / `page` `totalPages` `onPageChange` ← `Pagination`（20 件/頁、1 頁のみは `single-page`） / `total` ← 総件数 / `loading` `error` `isEmpty` `emptyMessage` ← `AsyncSection` へ委譲 |
| `FilterPanel` | `fields` ← 利用者区分（single、未選択で全件） / `onChange` `onSubmit` `onReset` ← 表示要素「利用者区分フィルター」（`ToggleGroup(single)`） の同名ハンドラ / `resultCount` ← 結果件数 / `collapsedByDefault` ← `true`（既定表示はキーワードのみ） / `submitting` ← 取得中フラグ |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true（司書が明示操作で開示する） / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 一覧は 20 件/頁で分割し、無限スクロールは使わない。`sm` 未満はテーブル親を `overflow-x` にする（カード切替はしない）
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
