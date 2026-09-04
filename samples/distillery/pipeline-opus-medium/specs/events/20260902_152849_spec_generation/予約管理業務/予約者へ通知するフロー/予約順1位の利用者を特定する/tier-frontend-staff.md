# 予約順1位の利用者を特定する - 司書ポータル仕様

## 変更概要

取置き対象者特定画面を追加し、予約待ちとなった書籍の取置き通知対象（予約順1位・予約状態が「予約中」の予約と申込者）を提示する。判定が「対象外」のときは根拠となった RDRA 条件名と充足していない項目をその場に展開する（反応型オンボーディング）。

## 画面仕様

### 取置き対象者特定画面

- **URL**: `/staff/holds/next`
- **アクセス権**: 司書（ログイン済み。役割=司書。館内ネットワークからのみアクセス可 / NFR E.5.3.1）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | `PortalShell`（variant: staff） | サイドバー + ヘッダー + 本文の骨格 |
| 予約の待ち行列 | ステッパー | `ReservationQueueTracker` | 予約順1位の候補と後続待ち人数を段階表示する |
| 候補予約の状態 | バッジ | `ReservationStatusBadge` | 候補予約の予約状態（予約中）を dot + 文言で表示 |
| 取置き対象者 | カード | `UserProfileCard`（variant: default） | 利用者番号・氏名・利用者区分を表示。連絡先は既定でマスクする |
| 取置き通知へ進む | ボタン | `Button`（default / md） | 取置き通知送信画面へ遷移する主操作。notifiable=false では非活性 |
| 対象外の理由 | 通知 | `Alert`（warning） | 書籍状態が「予約待ち」でない、または予約中の予約が無い場合に根拠条件名を表示 |
| 候補なし | 空状態 | `EmptyState`（with-action） | 「取置き対象の予約がありません」と書籍選択への導線を提示 |
| 読み込み中 | スケルトン | `Skeleton`（line） | 候補取得中に表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | `var(--semantic-background)` | `var(--color-white)` |
| アクセント（ポータル色） | `var(--primary)` | `var(--color-teal-700)` |
| 予約中の状態色 | `var(--semantic-info)` | `var(--color-blue-600)` |
| 対象外の警告色 | `var(--semantic-warning)` | `var(--color-amber-600)` |
| 個人情報マスク背景 | `var(--pii-mask-bg)` | `var(--color-gray-100)` |
| 個人情報マスク文字 | `var(--pii-mask-color)` | `var(--foreground-muted)` |
| セクション間余白 | `var(--section-gap)` | `var(--spacing-8)` |

#### UIロジック

- **状態管理**: 状態管理層（`L-frontend-staff-state`）で `selectedBookId`・`candidate`・`notifiable`・`loading`・`error` を保持し、取置き通知送信画面へ候補（予約ID・通知種別=取置き案内）を引き渡す
- **データ取得元**: 予約待ち書籍一覧は `GET /api/v1/staff/holds/pending-books`（書籍状態=予約待ちの書籍と待ち人数を返す）から取得し、そこで得た `book_id` を `GET /api/v1/staff/books/{book_id}/hold-candidate` の path パラメータに渡す。連絡先の開示時のみ `reveal_contact=true` を付与して再取得する
- **バリデーション**: 対象書籍が未選択の場合は「取置き通知へ進む」を非活性にする。`notifiable=false` の場合も非活性にし、根拠条件名（取置き通知対象条件）を `Alert(warning)` に表示する
- **ローディング**: 候補取得中は `Skeleton`（line）を表示する
- **エラーハンドリング**: 403 は `Alert(destructive)` で「この操作は司書のみ実行できます」、404 は `EmptyState` で「対象の書籍が見つかりません」、5xx は再試行導線つき `Alert(destructive)` を `role="alert"` で通知する
- **個人情報の段階的開示**: `UserProfileCard` の `maskContact` を既定 true とし、明示操作（「連絡先を表示」）で `revealed` に切り替える。開示操作は操作ログへ記録する（NFR E.1.2.1 / arch SR-006 / CLR-009）
- **アクセシビリティ**: 候補の更新は `aria-live="polite"` で通知する。状態バッジは色に加えて状態名の文言を必ず伴う

#### 操作フロー

1. 返却受付後、司書が取置き対象者特定画面 `/staff/holds/next` を開く
2. 予約待ちの書籍を選択する
3. 予約順1位の候補（予約ID・利用者番号・利用者区分・後続待ち人数）を確認する
4. 必要に応じて「連絡先を表示」で宛先メールアドレスを開示する
5. 「取置き通知へ進む」を押下し、取置き通知送信画面 `/staff/holds/notify` へ遷移する

## コンポーネント設計

### HoldCandidatePanel

- **ベースコンポーネント**: `Card` + `ReservationQueueTracker` + `ReservationStatusBadge` + `UserProfileCard`
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | object | Yes | 対象書籍（book_id, title, author, book_status） |
  | candidate | object | No | 取置き候補（reservation_id, priority, reservation_status, applied_at） |
  | user | object | No | 取置き対象者（user_no, name, user_category, emailMasked, email?） |
  | notifiable | boolean | Yes | 取置き通知対象条件を満たすか |
  | reasonCondition | string | No | 対象外のときの根拠条件名（取置き通知対象条件 等） |
  | remainingCount | number | Yes | 後続で待っている予約件数 |
  | loading | boolean | Yes | 読み込み中フラグ |
- **状態**: `contactRevealed`（連絡先の開示状態）
- **イベント**: `onRevealContact`（連絡先の開示）、`onProceedToNotify`（取置き通知送信画面へ遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 予約順1位の利用者を特定する - 司書ポータル

  Scenario: 予約待ちの書籍で候補が表示される
    Given 書籍 B-0001 の書籍状態が「予約待ち」で予約順位 1 の「予約中」予約 R-0007 が存在する
    When 司書が取置き対象者特定画面 /staff/holds/next で書籍 B-0001 を選択する
    Then 予約 R-0007 と利用者番号 U-0001 が表示される
    And 「取置き通知へ進む」ボタンが活性になる

  Scenario: 連絡先は既定でマスクされる
    Given 取置き候補として利用者番号 U-0001 が表示されている
    When 司書が画面を確認する
    Then UserProfileCard の連絡先がマスク表示される
    And 「連絡先を表示」の明示操作が用意されている

  Scenario: 対象外のときは根拠条件を表示する
    Given 書籍 B-0003 の書籍状態が「在庫あり」
    When 司書が取置き対象者特定画面 /staff/holds/next で書籍 B-0003 を選択する
    Then Alert(warning) に根拠条件名「取置き通知対象条件」が表示される
    And 「取置き通知へ進む」ボタンが非活性になる

  Scenario: 候補が無い場合に空状態を表示する
    Given 書籍 B-0002 の予約はすべて予約状態が「キャンセル」である
    When 司書が取置き対象者特定画面 /staff/holds/next で書籍 B-0002 を選択する
    Then EmptyState(with-action) に「取置き対象の予約がありません」が表示される
    And 別の書籍を選び直す導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | HoldCandidatePanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `PiiMaskedText` | `@/components/common/PiiMaskedText` | HoldCandidatePanel の候補者連絡先（`UserProfileCard`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← HoldCandidatePanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `PiiMaskedText` | `value` ← 連絡先の値 / `kind` ← `email` / `revealable` ← true / `onReveal` ← 開示の監査ログ通知（NFR E.1.2.1 / arch SR-006） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 表示要素の「ステッパー」は Domain の `ReservationQueueTracker` による進行表示である。共通フォームパターンが禁じる「入力 → 確認 → 完了の複数ページウィザード」のステッパーではない
- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
