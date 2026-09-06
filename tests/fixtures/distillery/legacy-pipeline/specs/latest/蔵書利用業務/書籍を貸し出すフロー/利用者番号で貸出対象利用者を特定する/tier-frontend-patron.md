# 利用者番号で貸出対象利用者を特定する - 利用者ポータル仕様

## 変更概要

利用者番号提示画面（`/mypage/card`）を追加する。ログイン中の利用者本人の利用者番号・氏名・利用者区分・利用者状態を窓口提示に適した大きさで表示する。連絡先は既定でマスクし、他利用者へ到達する導線を持たない。

## 画面仕様

### 利用者番号提示画面

- **ルート id**: `patron-mypage-card`
- **URL**: `/mypage/card`（正本は `appRoutes`。画面側で URL 文字列を直書きしない）
- **アクセス権**: 利用者（ログイン済み。本人のデータのみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格（サイドバー・ヘッダー・本文） | レイアウト | PortalShell（variant: patron） | 利用者ポータル共通レイアウト。ポータル色は `primary_patron` |
| 利用者番号カード | カード | Card（variant: default） | 利用者番号を最大サイズ（`font_size` 3xl 相当）で表示する窓口提示エリア |
| 登録内容（氏名・利用者区分・連絡先） | カード | UserProfileCard（variant: default / revealed） | `maskContact` を既定 true とし、明示操作で開示する |
| 利用者状態バッジ | バッジ | UserStatusBadge | 「登録済み」「取引進行中」を dot + 文言で表示 |
| 窓口提示の案内 | 注意喚起 | Alert（variant: info） | 「この画面を窓口で司書にご提示ください」を表示 |
| 取得中表示 | ローディング | `LoadingState`（`kind="detail"`） | loading 表現の唯一の入口。利用者カード（単一エンティティ）の取得待ちを表示する（`label`「利用者カードを読み込み中」）。応答が 0.4 秒を超える可能性があるため表示する（ドハティの閾値） |
| 取得失敗表示 | エラー | Alert（variant: destructive） | 通信エラー時に再試行導線とともに表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| 本文色 | var(--semantic-foreground) | var(--color-gray-900) |
| 補足色 | var(--semantic-foreground-secondary) | var(--color-gray-600) |
| アクセント | var(--portal-primary) → var(--semantic-primary_patron) | var(--color-blue-700) |
| カード | var(--component-card-bg) / var(--component-card-padding) | var(--color-white) / var(--card-padding) |
| 状態バッジ（登録済み） | var(--semantic-success) | var(--color-green-600) |
| 状態バッジ（取引進行中） | var(--semantic-info) | var(--color-blue-600) |
| 個人情報マスク | var(--component-pii-mask-bg) / var(--component-pii-mask-color) | design tokens の pii 定義に従う |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。共有する状態は認証情報のみで、利用者番号はレスポンスから都度取得する。
- **バリデーション**: 入力項目を持たない画面のため、フロントエンドバリデーションは行わない。
- **ローディング**: 取得中は `LoadingState`（`kind="detail"` / `label`「利用者カードを読み込み中」）を利用者番号カードと UserProfileCard の位置に表示し、レイアウトシフトを起こさない（`AsyncSection` の `skeleton` prop 経由）。画面側で `Skeleton` / `Spinner` を直接使わない。
- **エラーハンドリング**: api client 層で分類されたエラー（通信 / 認可 / 業務）を受け取り、view 層で利用者向けの平易なメッセージへ変換する（LR-027）。技術的例外・内部 ID は表示しない。401 は再ログイン誘導、403 は「他の利用者の情報は参照できません」、404 は「利用者情報が見つかりません」を表示する。
- **本人限定参照の UI 制約**: 利用者番号をパスやクエリで指定する導線を持たず、常に `GET /api/v1/me/card`（認証コンテキストの利用者）だけを呼ぶ（LP-025）。
- **PII の非永続化**: 氏名・利用者番号・連絡先をブラウザの永続ストレージへ保存しない（CLR-008）。

#### 操作フロー

1. 利用者がサイドバーの「マイページ」→「利用者番号を提示」を選択し、`useAppNavigation().navigate("patron-mypage-card")` で本画面を開く。
2. api client が `GET /api/v1/me/card` を呼び出す（trace_id 付与）。
3. 取得中は `LoadingState`（`kind="detail"`）を表示する。
4. 取得成功時、利用者番号を最大サイズで、氏名・利用者区分・利用者状態をその下に表示する。
5. 連絡先は既定でマスク表示し、「表示する」操作で開示する（段階的開示）。
6. 利用者は画面を司書に提示する。以降の貸出可否判定・貸出登録は司書ポータルで行う。

## コンポーネント設計

### PatronCardPanel

- **ベースコンポーネント**: Card（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | userNumber | string | Yes | 利用者番号。窓口提示用に最大サイズで表示する |
  | loading | boolean | No | true のとき `LoadingState`（`kind="detail"`）を表示する |
- **状態**: なし（表示専用）
- **イベント**: なし

### UserProfileCard（本 UC 用の利用）

- **ベースコンポーネント**: UserProfileCard（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | user | { userNo: string; name: string; userCategory: string; userStatus: string } | Yes | 表示する利用者の登録内容。連絡先はレスポンスに含まれない |
  | maskContact | boolean | Yes | 既定 true。明示操作で false（variant: revealed）へ切り替える |
  | actions | ReactNode | No | 本 UC では指定しない（変更・退会の導線はマイページ登録内容画面に置く） |
- **状態**: `revealed`（連絡先の開示可否。画面ローカル）
- **イベント**: `onToggleReveal`（連絡先の開示切替）

## ティア完了条件（BDD）

```gherkin
Feature: 利用者番号で貸出対象利用者を特定する - 利用者ポータル

  Scenario: 利用者番号が窓口提示できる大きさで表示される
    Given 利用者「田中太郎」（利用者番号 "U-000123"、利用者区分 "一般"、利用者状態 "登録済み"）がログイン済み
    When 利用者が利用者番号提示画面（/mypage/card）を開く
    Then 利用者番号 "U-000123" が最大サイズのカードに表示される
    And UserStatusBadge に「登録済み」が dot と文言で表示される

  Scenario: 連絡先は既定でマスクされる
    Given 利用者「田中太郎」が利用者番号提示画面を開いている
    When 画面が初期表示される
    Then UserProfileCard の連絡先はマスク表示（variant: default）である
    And 「表示する」を押すと variant: revealed に切り替わる

  Scenario: 取得中は LoadingState を表示する
    Given 利用者「田中太郎」がログイン済み
    When 利用者番号提示画面を開き、API 応答が 0.4 秒以上かかる
    Then 利用者番号カードと UserProfileCard の位置に LoadingState(kind="detail") が表示される

  Scenario: 取得に失敗したら平易なメッセージを表示する
    Given バックエンド API が 500 を返す状態である
    When 利用者が利用者番号提示画面を開く
    Then Alert(destructive) に「利用者情報を取得できませんでした。時間をおいて再度お試しください」が表示される
    And スタックトレースや内部 ID は表示されない
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `AppShell` | `@/components/common/AppShell` | 本画面のシェル。ポータル・画面名・アクティブナビ・404 判定を担う |
| `useAppNavigation` | `@/components/common/hooks/useAppNavigation` | 本画面からの遷移 API（マイページからの入口をルート id で解決する） |
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `LoadingState` | `@/components/common/LoadingState` | 表示要素「取得中表示」（利用者カードの取得待ち。`kind="detail"`） |
| `AsyncSection` | `@/components/common/AsyncSection` | PatronCardPanel / UserProfileCard の読み込み中 / 0 件 / 取得失敗の 3 状態（`LoadingState` / `EmptyState` / `Alert(destructive)`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | UserProfileCard の連絡先（`maskContact`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `LoadingState` | `kind` ← `"detail"`（利用者カードは単一エンティティの詳細取得） / `label` ← `"利用者カードを読み込み中"` |
| `AsyncSection` | `loading` ← PatronCardPanel / UserProfileCard の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"detail"`（`LoadingState` の `kind` にそのまま渡る） / `loadingLabel` ← `"利用者カードを読み込み中"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← false（窓口提示画面のため既定マスクのまま） / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- ルート表 `appRoutes` と `AppShell` はデザインシステムが所有し、実装リポは `onNavigate` にルーターの遷移関数を注入するだけとする
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
