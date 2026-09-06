# 自分の利用者情報を照会する - 利用者ポータル仕様

## 変更概要

利用者ポータル（`tier-frontend-patron`）にマイページ登録内容画面を追加する。本人の登録内容を `UserProfileCard` で提示し、連絡先は既定でマスクして明示操作でのみ開示する。他利用者の情報へ到達する導線は置かない（LP-025）。

## 画面仕様

### マイページ登録内容画面

- **URL**: `/mypage`
- **アクセス権**: 利用者（ログイン中の本人のみ。参照対象は認証コンテキストの利用者番号に固定される）
- **ポータル**: `patron`

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | `PortalShell`（`patron`） | サイドバー「マイページ」を選択状態にする |
| 登録内容 | カード | `UserProfileCard`（`default` / `revealed`） | 利用者番号・氏名・利用者区分・登録日時。連絡先は `maskContact` で既定マスク |
| 利用者状態 | バッジ | `UserStatusBadge` | 登録済み / 取引進行中。`dot` と文言を併記する |
| 読み込み中 | プレースホルダ | `Skeleton`（`line`） | 応答が 0.4 秒を超える可能性があるため表示する |
| 取得失敗 | メッセージ | `Alert`（`destructive`） | 平易な日本語。内部情報は出さない（LR-027） |
| 利用者番号提示への導線 | ボタン | `Button`（`outline`） | `/mypage/card` へ遷移 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| 本文色 | `var(--semantic-foreground)` | `var(--color-gray-900)` |
| 補足文字色 | `var(--foreground-secondary)` | `var(--color-gray-600)` |
| ポータルアクセント | `var(--primary)` | `var(--color-blue-700)`（`#1D4ED8`） |
| カード余白 | `var(--card-padding)` | `var(--spacing-6)` |
| 個人情報マスク背景 | `var(--pii-mask-bg)` | ダークでは `var(--color-gray-800)` |
| ページ余白 | `var(--page-padding)` | `var(--spacing-6)` |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026。利用者ポータルは独立した状態管理層を持たない）。認証情報は API クライアント層が保持し、ビュー層はトークンの実体を扱わない（LP-027）。
- **バリデーション**: 入力項目が無いため画面側のバリデーションは行わない（照会のみ）。
- **ローディング**: 取得中は `Skeleton`（`line`）でカードの骨格を表示し、レイアウトシフトを避ける。
- **エラーハンドリング**: API クライアント層が分類したエラーを受け取り（CLP-012）、`Alert(destructive)` に平易なメッセージを表示する。技術的な例外内容・内部 ID は表示しない（LR-027）。401 はログイン画面へ誘導する（LP-027）。
- **段階的開示**: 連絡先は既定でマスクする（初回取得は `GET /api/v1/me`。生の連絡先はレスポンスに含まれない）。「連絡先を表示する」の明示操作で `GET /api/v1/me?reveal=true` を再要求し、返った `email` を用いて `revealed` に切り替える。開示状態と取得した生の連絡先はブラウザストレージへ保存しない（CLR-008）。
- **本人限定参照の UI 制約**: 利用者番号を指定して他人の情報を参照する導線・入力欄を持たない（LP-025）。
- **アクセシビリティ**: マスク解除トグルは `aria-pressed` を持つ。取得完了は `aria-live="polite"`、エラーは `role="alert"`。日付は `toLocaleDateString('ja-JP')` で書式化する。

#### 操作フロー

1. 利用者がサイドバー「マイページ」からマイページ登録内容画面を開く。
2. API クライアント層が `GET /api/v1/me` を要求する（利用者番号はクライアントから送らない）。
3. 取得中は `Skeleton` を表示し、完了後に `UserProfileCard` を描画する。
4. 利用者が「連絡先を表示する」を押すと `GET /api/v1/me?reveal=true` を再要求し、返った `email` を開示する。
5. 利用者番号を窓口で提示する場合は `/mypage/card` へ遷移する。

## コンポーネント設計

### UserProfileCard（マイページ登録内容画面での利用）

- **ベースコンポーネント**: `UserProfileCard`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | user | MyProfile | Yes | 利用者番号・氏名・マスク済み連絡先・利用者区分・利用者状態・登録日時 |
  | maskContact | boolean | Yes | 既定 true。明示操作で false（`revealed`） |
  | actions | Action[] | No | 「連絡先を表示する」トグルと `/mypage/card` への導線 |
- **状態**: `default` / `revealed` / `in-transaction`（利用者状態が取引進行中のとき）
- **イベント**: `onToggleMask`（連絡先の開示切替）

### UserStatusBadge（登録内容カード内での利用）

- **ベースコンポーネント**: `UserStatusBadge`（domain コンポーネント）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | state | "登録済み" \| "取引進行中" | Yes | 利用者状態。`stateMaps` を正本とする |
  | dot | boolean | No | 色ドットの表示。文言は常に併記する |
- **状態**: 登録済み（`success`） / 取引進行中（`info`）
- **イベント**: なし

## ティア完了条件（BDD）

```gherkin
Feature: 自分の利用者情報を照会する - 利用者ポータル

  Scenario: 登録内容カードが描画される
    Given バックエンド API が {"user_no":"U-000123","name":"田中太郎","user_category":"一般","user_status":"登録済み"} を返すようスタブされている
    When 利用者がマイページ登録内容画面（/mypage）を表示する
    Then UserProfileCard に「U-000123」と「田中太郎」が表示される
    And UserStatusBadge に「登録済み」が表示される

  Scenario: 連絡先が既定でマスクされる
    Given バックエンド API が email_masked「t****@example.com」を返すようスタブされている
    When 利用者がマイページ登録内容画面を表示する
    Then 連絡先に「t****@example.com」が表示される
    And 生の連絡先は DOM に含まれない

  Scenario: 明示操作で連絡先を開示する
    Given 利用者がマイページ登録内容画面を表示している
    And GET /api/v1/me?reveal=true が email「tanaka@example.com」を返すようスタブされている
    When 利用者が「連絡先を表示する」を押す
    Then GET /api/v1/me?reveal=true が要求される
    And UserProfileCard が revealed 状態になり「tanaka@example.com」が表示される
    And トグルの aria-pressed が true になる

  Scenario: 取得中は Skeleton を表示する
    Given バックエンド API の応答が 1 秒遅延するようスタブされている
    When 利用者がマイページ登録内容画面を表示する
    Then Skeleton(line) が表示される
    And 応答後に UserProfileCard へ置き換わる

  Scenario: 取得失敗時に内部情報を出さずエラーを表示する
    Given バックエンド API が HTTP 500 とスタックトレースを返すようスタブされている
    When 利用者がマイページ登録内容画面を表示する
    Then Alert(destructive) に平易なメッセージが表示される
    And 画面にスタックトレースが表示されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | UserProfileCard（マイページ登録内容） の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | UserProfileCard の連絡先（`maskContact`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← UserProfileCard（マイページ登録内容） の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← false（本人の登録内容画面。明示操作で開示する場合のみ true） / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
