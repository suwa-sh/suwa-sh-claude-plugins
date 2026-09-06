# 自分の貸出内容と返却期限を照会する - 利用者ポータル仕様

## 変更概要

貸出内容・返却期限確認画面（`/loans/:loanId`）を追加する。ログイン中の利用者本人の貸出 1 件について、書籍情報・貸出日・貸出期間区分・返却期限・残日数を表示する。返却期限は DueDateIndicator で 3 段階に視覚化し、色だけでなく日数の文言でも示す。

## 画面仕様

### 貸出内容・返却期限確認画面

- **URL**: `/loans/:loanId`
- **アクセス権**: 利用者（ログイン済み。本人に紐づく貸出のみ）
- **ポータル**: patron

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル骨格 | レイアウト | PortalShell（variant: patron） | 利用者ポータル共通レイアウト |
| 貸出内容のまとめ | カード | Card（variant: default） | 貸出日・貸出期間区分・貸出IDを表示 |
| 返却期限 | 期限表示 | DueDateIndicator（variant: safe / near / due-today / overdue, size: md） | 残日数・超過日数を数値と文言で示す。色だけに依存しない |
| 貸出状態バッジ | バッジ | LoanStatusBadge | 貸出中 / 延滞 / 返却済みを dot + 文言で表示 |
| 対象書籍 | カード | BookCard（variant: default / on-loan） | タイトル・著者・ISBN・出版社・ジャンル・資料種別を表示 |
| 取得中表示 | ローディング | Skeleton（variant: line） | 応答が 0.4 秒を超える可能性があるため表示（ドハティの閾値） |
| 取得失敗・未検出表示 | エラー | Alert（variant: destructive） | 404 は「該当する貸出が見つかりません」を表示 |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | var(--color-white) |
| 本文色 | var(--semantic-foreground) | var(--color-gray-900) |
| アクセント | var(--portal-primary) → var(--semantic-primary_patron) | var(--color-blue-700) |
| 返却期限（余裕あり） | var(--component-duedate-safe_color) / var(--component-duedate-safe_bg) | var(--success) / var(--success-light) |
| 返却期限（期限接近） | var(--component-duedate-near_color) / var(--component-duedate-near_bg) | var(--pending) / var(--pending-light) |
| 返却期限（超過） | var(--component-duedate-over_color) / var(--component-duedate-over_bg) | var(--destructive) / var(--destructive-light) |
| 貸出状態（貸出中 / 延滞 / 返却済み） | var(--semantic-info) / var(--semantic-destructive) / var(--semantic-neutral) | var(--color-blue-600) / var(--color-red-600) / var(--color-gray-500) |
| カード | var(--component-card-bg) / var(--component-card-padding) | var(--color-white) / var(--card-padding) |

#### UIロジック

- **状態管理**: 画面ローカルに保持する（LR-026）。`loanId` はルーティングのパスパラメータで表現し、共有状態を持たない。
- **バリデーション**: 入力項目を持たない画面のため、フロントエンドバリデーションは行わない。
- **ローディング**: 取得中は Skeleton（line）を Card / BookCard の位置に表示し、レイアウトシフトを避ける。
- **エラーハンドリング**: api client 層で分類されたエラーを view 層で利用者向けの平易なメッセージへ変換する（LR-027 / CLP-012）。401 は再ログイン誘導、404（本人の貸出が見つからない、または他利用者の貸出）は「該当する貸出が見つかりません」を表示し、現在の貸出一覧（`/loans`）への導線を出す。技術的例外・内部 ID は表示しない。
- **本人限定参照の UI 制約**: 利用者番号を指定して他人の貸出を参照する導線を持たない（LP-025）。API は常に `/api/v1/me/loans/{loanId}` を呼ぶ。
- **PII の非永続化**: 貸出内容・書籍情報をブラウザの永続ストレージへ保存しない（CLR-008）。
- **日付書式**: 返却期限・貸出日は `toLocaleDateString('ja-JP')` で書式化する（arch SR-004）。
- **アクセシビリティ**: DueDateIndicator は残日数・超過日数を文言で必ず併記し、色のみで意味を伝えない。非同期更新は `aria-live="polite"`、エラーは `role="alert"` で通知する。

#### 操作フロー

1. 利用者が現在の貸出一覧画面（`/loans`）で対象の貸出を選択する。
2. 貸出内容・返却期限確認画面（`/loans/:loanId`）へ遷移する。
3. api client が `GET /api/v1/me/loans/{loanId}` を呼び出す（trace_id 付与）。
4. 取得中は Skeleton を表示する。
5. 取得成功時、貸出日・貸出期間区分・返却期限・残日数・貸出状態・対象書籍を表示する。
6. 返却期限が超過している場合は DueDateIndicator（overdue）で超過日数を示し、返却対象貸出確認画面（`/loans/return`）への導線を出す。

## コンポーネント設計

### LoanDetailPanel

- **ベースコンポーネント**: Card（UI） + LoanStatusBadge（Domain） + DueDateIndicator（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | loan | { loanId: string; loanDate: string; loanPeriodType: string; dueDate: string; daysRemaining: number; loanStatus: string } | Yes | 表示する貸出の内容 |
  | today | string(date) | Yes | 本日日付。DueDateIndicator の表示段階の算出に使う |
  | loading | boolean | No | true のとき Skeleton を表示する |
- **状態**: なし（表示専用）
- **イベント**: なし

### LoanBookSummary

- **ベースコンポーネント**: BookCard（Domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | book | { bookId: string; title: string; author: string; isbn: string; publisher: string; genre: string; materialType: string } | Yes | 貸出対象の書籍。書籍状態は本画面では表示しない（貸出中で自明のため） |
  | onSelect | () => void | No | 書籍詳細・在庫状況画面への遷移ハンドラ |
- **状態**: なし（表示専用）
- **イベント**: `onSelect`（書籍詳細への遷移）

## ティア完了条件（BDD）

```gherkin
Feature: 自分の貸出内容と返却期限を照会する - 利用者ポータル

  Scenario: 貸出内容と返却期限が表示される
    Given 利用者「田中太郎」がログイン済みで、本日が 2026-09-02 である
    And API が貸出「L-000001」（返却期限 2026-09-16、残日数 14、貸出状態 "貸出中"、書籍「吾輩は猫である」）を返す
    When 利用者が貸出内容・返却期限確認画面（/loans/L-000001）を開く
    Then 返却期限「2026年9月16日」と「あと 14 日」が表示される
    And DueDateIndicator の variant が safe である
    And LoanStatusBadge に「貸出中」が dot と文言で表示される

  Scenario: 期限接近の貸出は near で表示される
    Given 利用者「田中太郎」がログイン済みで、本日が 2026-09-02 である
    And API が貸出「L-000002」（返却期限 2026-09-04、残日数 2）を返す
    When 利用者が貸出内容・返却期限確認画面（/loans/L-000002）を開く
    Then DueDateIndicator の variant が near で「あと 2 日」と表示される

  Scenario: 超過した貸出は overdue で超過日数を表示し返却導線を出す
    Given 利用者「田中太郎」がログイン済みで、本日が 2026-09-02 である
    And API が貸出「L-000003」（返却期限 2026-08-30、残日数 -3、貸出状態 "延滞"）を返す
    When 利用者が貸出内容・返却期限確認画面（/loans/L-000003）を開く
    Then DueDateIndicator の variant が overdue で「3 日超過」と表示される
    And 返却対象貸出確認画面（/loans/return）への導線が表示される

  Scenario: 取得中は Skeleton を表示する
    Given 利用者「田中太郎」がログイン済み
    When 貸出内容・返却期限確認画面を開き、API 応答が 0.4 秒以上かかる
    Then Card と BookCard の位置に Skeleton(line) が表示される

  Scenario: 該当する貸出がないときは平易なメッセージと一覧導線を表示する
    Given 利用者「田中太郎」がログイン済み
    And API が HTTP 404 を返す
    When 利用者が貸出内容・返却期限確認画面（/loans/L-999999）を開く
    Then Alert(destructive) に「該当する貸出が見つかりません」が表示される
    And 現在の貸出一覧（/loans）への導線が表示される
```

## 共通コンポーネント参照

`_cross-cutting/ux-ui/common-components.md`（共通コンポーネント設計）を正本とし、本 UC の presentation を共通層へ接続する。共通コンポーネントは既存 UI / Domain コンポーネントの合成であり、新しい視覚表現・状態・トークンは導入しない。

### 使用する共通コンポーネント

| 共通コンポーネント | インポートパス | 本 UC での適用先 |
|---|---|---|
| `PortalPageLayout` | `@/components/common/PortalPageLayout` | 表示要素「ポータル骨格」（`PortalShell`（`patron`）） |
| `AsyncSection` | `@/components/common/AsyncSection` | LoanDetailPanel の読み込み中 / 0 件 / 取得失敗の 3 状態（`Skeleton` / `EmptyState` / `Alert(destructive)`） |

### Props マッピング

| 共通コンポーネント | Props ← 本 UC の供給元 |
|---|---|
| `PortalPageLayout` | `portal` ← `"patron"` / `title` ← 画面見出し / `width` ← `"contained"` / `breadcrumb` ← 一覧 → 詳細 → 操作の現在位置 / `actions` ← 画面の主操作 / `children` ← 本画面の表示要素 |
| `AsyncSection` | `loading` ← LoanDetailPanel の `loading` / `error` ← 同 `error` / `isEmpty` ← 取得件数 0 / `skeleton` ← `"line"` / `emptyMessage` ← 本 UC の空状態メッセージ / `onRetry` ← 再取得ハンドラ / `announce` ← `true`（件数は `aria-live="polite"`、エラーは `role="alert"`） |

### 共通フック

| フック | インポートパス | 本 UC での用途 |
|---|---|---|
| `useApiErrorPresenter` | `@/components/common/hooks/useApiErrorPresenter` | API エラーを 4 分類（通信 / 認可 / 業務ルール違反 / 競合）に正規化し、表示先と重篤度を決める（arch LR-031 / CLP-014）。本 UC の「エラーハンドリング」の分岐は本フックの横断規約に従う |

### 適用上の注意

- 上記の UC 固有コンポーネントは廃止せず、共通コンポーネントを内側で使う薄いアダプタとして残す（本書の BDD をそのまま満たすため）
