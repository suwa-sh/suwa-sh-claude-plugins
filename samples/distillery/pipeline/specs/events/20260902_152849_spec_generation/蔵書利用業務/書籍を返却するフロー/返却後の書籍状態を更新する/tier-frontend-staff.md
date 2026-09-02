# 返却後の書籍状態を更新する - 司書ポータル仕様

## 変更概要

返却後在庫整理画面（`/staff/returns/:loanId/restock`）を追加する。返却受付直後の書籍について、有効な予約の有無に応じた遷移先（在庫あり / 予約待ち）を提示し、冪等キー付きで書籍状態を更新する。予約待ちになった場合は取置き対象者特定画面への導線をその場に出す。

## 画面仕様

### 返却後在庫整理画面

- **URL**: `/staff/returns/:loanId/restock`
- **アクセス権**: 司書（司書ロールのトークンを持つ場合のみ表示。館内ネットワークからのアクセスに限定する）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: staff） | 司書ポータル共通レイアウト |
| 対象書籍 | カード | BookCard（variant: default / reserved） | タイトル・著者・ISBN・ジャンル・資料種別・予約件数を表示 |
| 書籍状態バッジ | バッジ | BookStatusBadge | 更新前は「貸出中」、更新後は「在庫あり」または「予約待ち」を dot + 文言で表示 |
| 次順位の予約状態バッジ | バッジ | ReservationStatusBadge | 取置き対象候補となる予約の予約状態「予約中」を表示 |
| 遷移先の案内 | 注意喚起 | Alert（variant: info / warning） | 予約なし → 「在庫ありへ戻します」、予約あり → 「予約順1位の利用者のために取り置きます」 |
| 在庫整理の実行 | ボタン | Button（variant: default, size: md） | 主操作。送信中は `loading` かつ `disabled` / `aria-busy` |
| 取置き対象者特定への導線 | ボタン | Button（variant: outline, size: md） | 予約待ちになった場合のみ表示する副次操作 |
| 更新結果 | 注意喚起 | Alert（variant: success / destructive） | 成功時は遷移後の書籍状態、失敗時は理由を表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| アクセント | var(--portal-primary) → var(--semantic-primary_staff) | var(--color-teal-700) |
| 書籍状態（在庫あり / 貸出中 / 予約待ち） | var(--semantic-success) / var(--semantic-info) / var(--semantic-warning) | var(--color-green-600) / var(--color-blue-600) / var(--color-amber-600) |
| 予約状態（予約中） | var(--semantic-info) | var(--color-blue-600) |
| カード | var(--component-card-bg) / var(--component-card-padding) | var(--color-white) / var(--card-padding) |
| 余白 | var(--spacing-page_padding) / var(--spacing-component_gap) | var(--spacing-6) / var(--spacing-3) |

#### UIロジック

- **状態管理**: 返却登録画面から引き継いだ貸出ID・書籍IDを状態管理層から取得する（LP-030）。更新成功後は蔵書一覧・予約状況一覧・在庫状況レポートの関連キャッシュを無効化する。
- **バリデーション**: 入力項目を持たない確認主体の画面のため、送信前バリデーションは対象（書籍ID・貸出ID）が引き継がれていることの確認のみとする。遷移先の決定はフロント側で独自判定せず、API の応答を正とする（LR-030）。
- **遷移先の事前案内**: 画面表示時に対象書籍の有効な予約件数を取得し、Alert(info / warning) で遷移先の見込みを案内する。この表示は確認用で、確定した書籍状態は API のレスポンス（`book_status`）で置き換える。
- **ローディング**: 更新中は Button を `loading` かつ `disabled` / `aria-busy="true"` にする（arch SR-002）。応答が 0.4 秒を超える場合は結果領域に Skeleton を表示する。
- **二重送信防止**: 冪等キー（UUID）を画面初期化時に 1 回だけ生成し、`X-Idempotency-Key` ヘッダに付与する。再送時も同一キーを使う（LR-032）。
- **エラーハンドリング**: api client から伝播したエラーを状態管理層で分類（通信 / 認可 / 業務ルール違反 / 競合）し（LR-031）、view 層で司書向けメッセージへ変換する。409（貸出中でない）は Alert(destructive) に表示し、蔵書管理台帳への導線を出す。
- **アクセシビリティ**: BookStatusBadge / ReservationStatusBadge は色のみで意味を伝えず、状態名の文言を必ず伴う。更新完了は `aria-live="polite"` で通知する。

#### 操作フロー

1. 返却登録の完了画面から「在庫を整える」導線で本画面へ前方遷移する。
2. 対象書籍と有効な予約の件数が表示され、Alert に遷移先の見込みが案内される。
3. 司書が「在庫を整える」を押す。冪等キー付きで `POST /api/v1/books/{bookId}/restock` を呼び出す。
4. 成功かつ `book_status` が「在庫あり」のとき、BookStatusBadge を「在庫あり」に更新し、次の返却受付（`/staff/returns/new`）への導線を 1 つ提示する。
5. 成功かつ `book_status` が「予約待ち」のとき、BookStatusBadge を「予約待ち」に更新し、予約順1位の利用者番号と ReservationStatusBadge「予約中」を提示したうえで、取置き対象者特定画面（`/staff/holds/next`）への導線をその場に出す。
6. 失敗時、Alert(destructive) に理由（貸出中でない / 書籍が見つからない）を表示する。

## コンポーネント設計

### RestockConfirmPanel

- **ベースコンポーネント**: BookCard（Domain） + BookStatusBadge（Domain） + Alert（UI） + Button（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | { bookId: string; title: string; author: string; isbn: string; genre: string; materialType: string; bookStatus: string } | Yes | 在庫整理の対象書籍 |
  | activeReservationCount | number | Yes | 予約状態が「予約中」の予約件数。遷移先の見込み案内に使う |
  | submitting | boolean | Yes | true のとき Button を loading / disabled / aria-busy にする |
  | onSubmit | (input: { bookId: string; loanId: string; idempotencyKey: string }) => void | Yes | 在庫整理を発火する |
- **状態**: `idempotencyKey`（画面初期化時に 1 回だけ生成）
- **イベント**: `onSubmit`（在庫整理の実行）

### RestockResultPanel

- **ベースコンポーネント**: Alert（UI） + BookStatusBadge（Domain） + ReservationStatusBadge（Domain） + Button（UI）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | bookStatus | string | Yes | 遷移後の書籍状態（在庫あり / 予約待ち） |
  | previousBookStatus | string | Yes | 遷移前の書籍状態（貸出中） |
  | nextReservation | { reservationId: string; priority: number; userNo: string } \| null | No | 予約待ちのときの取置き対象候補。null なら在庫ありへ戻った |
  | onProceedToHold | () => void | No | 取置き対象者特定画面への遷移ハンドラ。`nextReservation` が非 null のときのみ表示する |
  | error | { code: string; message: string } \| null | No | 業務エラー。非 null で Alert(destructive) を表示 |
- **状態**: なし（表示専用）
- **イベント**: `onProceedToHold`（取置き対象者特定への遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 返却後の書籍状態を更新する - 司書ポータル

  Scenario: 予約がない書籍は在庫ありとして表示される
    Given 司書「山田花子」が返却後在庫整理画面（/staff/returns/L-000001/restock）を開いている
    And API が book_status "在庫あり"、next_reservation null を返す
    When 司書が「在庫を整える」を押す
    Then BookStatusBadge に「在庫あり」が dot と文言で表示される
    And 取置き対象者特定画面への導線は表示されない

  Scenario: 予約がある書籍は予約待ちとして表示され取置き導線が出る
    Given 司書「山田花子」が返却後在庫整理画面（/staff/returns/L-000002/restock）を開いている
    And API が book_status "予約待ち"、next_reservation（reservation_id "R-000001"、priority 1、user_no "U-000123"）を返す
    When 司書が「在庫を整える」を押す
    Then BookStatusBadge に「予約待ち」が表示される
    And ReservationStatusBadge に「予約中」が表示され、利用者番号 "U-000123" が提示される
    And 取置き対象者特定画面（/staff/holds/next）への導線が表示される

  Scenario: 実行前に遷移先の見込みが案内される
    Given 書籍「坊っちゃん」に予約状態 "予約中" の予約が 2 件存在する
    When 司書が返却後在庫整理画面を開く
    Then Alert(warning) に「予約順1位の利用者のために取り置きます」が表示される

  Scenario: 更新中は二重送信を防止する
    Given 司書「山田花子」が返却後在庫整理画面を開いている
    When 司書が「在庫を整える」を連続で 2 回押す
    Then Button は loading かつ disabled で aria-busy が true になる
    And API リクエストは同一の X-Idempotency-Key で 1 回だけ送信される

  Scenario: 貸出中でない書籍のエラーを平易に表示する
    Given 司書「山田花子」が返却後在庫整理画面を開いている
    And API が HTTP 409（code "BOOK_NOT_ON_LOAN"）を返す
    When 司書が「在庫を整える」を押す
    Then Alert(destructive) に「この書籍は貸出中ではないため在庫整理できません」が表示される
    And 蔵書管理台帳画面への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`staff`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | RestockConfirmPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |
| `SubmitActionButton` | `@/components/common/SubmitActionButton` | RestockConfirmPanel の更新実行ボタン（`onSubmit`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"staff"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← RestockConfirmPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |
| `SubmitActionButton` | `idempotencyKey` ← `useIdempotentMutation` が画面表示時に発行した UUID（`X-Idempotency-Key`） / `variant` ← `"default"` / `onSubmit` ← 既存の送信ハンドラ / `submitting` ← `submitting`（`disabled` + `aria-busy="true"`） / `children` ← 既存のボタンラベル |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useIdempotentMutation` | `@/components/common/hooks/useIdempotentMutation` | 画面表示時に UUID を発行し、送信・再送で同一の `X-Idempotency-Key` を維持する（arch SR-002 / LR-032）。`SubmitActionButton` へ `idempotencyKey` と `submitting` を渡す |
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
