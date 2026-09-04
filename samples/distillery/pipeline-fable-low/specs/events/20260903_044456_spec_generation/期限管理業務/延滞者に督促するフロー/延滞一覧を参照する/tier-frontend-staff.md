# 延滞一覧を参照する - 司書向けフロントエンド仕様

## 変更概要

司書ポータルの「予約・延滞状況」グループに延滞・督促状況画面（`/staff/overdues`）を追加する。`GET /api/v1/loans?status=OVERDUE` の結果を StatCard と OverdueTable（DueDateIndicator overdue、PiiMaskedText）で表示し、行展開で `GET /api/v1/loans/{loanId}/notifications` の通知記録を NotificationLogTable に表示する。延滞行から窓口利用状況照会画面へ利用者番号を引き継いで遷移できる（ux-design 遷移ルール）。

## 画面仕様

### 延滞・督促状況画面

- **URL**: `/staff/overdues?userNumber={利用者番号}&sort={dueDate|overdueDays|lastNotice}&page={n}`
- **アクセス権**: 司書（認証 + 司書区分必須。館内経路）
- **ポータル**: staff

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| ポータル外枠 | レイアウト | PortalShell（staff） | サイドバー「予約・延滞状況」グループ |
| 延滞件数 | テキスト | StatCard | label「延滞件数」、value = summary.overdueCount、unit「件」（先頭に配置） |
| 督促失敗件数 | テキスト | StatCard | label「督促失敗」、value = summary.noticeFailedCount。1 以上なら destructive 強調 |
| 督促待ち件数 | テキスト | StatCard | label「督促待ち」、value = summary.noticePendingCount |
| 利用者絞り込み | フォーム | Input（with-icon） | 利用者番号で絞り込み（Enter で適用） |
| 延滞一覧 | テーブル | OverdueTable | 利用者 / 書籍 / 返却期限 / 延滞日数 / 最終督促日時 / 送信結果 / 督促回数 / 操作 |
| 返却期限 | 表示 | DueDateIndicator（variant: overdue） | dueDate・today から「YYYY/MM/DD（N 日超過）」 |
| 貸出の状態 | バッジ | LoanStatusBadge（state: 延滞, dot） | destructive（red） |
| メールアドレス | 表示 | PiiMaskedText（kind: email, revealable） | 既定マスク。目のアイコンで明示開示 |
| 通知記録 | テーブル | NotificationLogTable | 行展開で表示。通知種別 / 送信先（PiiMaskedText） / 送信日時 / 送信結果 |
| ページ送り | ナビゲーション | Pagination | 20 件/頁 |
| 読み込み中 | ローディング | Skeleton（card × 3, table） | 初回・ページ切替 |
| データなし | 空状態 | EmptyState（default） | 「延滞中の貸出はありません」 |
| エラー | 通知 | Alert（destructive） | 403 / 5xx |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--background) | design tokens semantic.background |
| アクセント | var(--primary) | staff = #334155（Shelf Slate） |
| 延滞バッジ | var(--destructive) / var(--destructive-light) | semantic.destructive（red） |
| 期限超過 | var(--due-date-overdue) | component.due_date.overdue = var(--destructive) |
| 送信結果 成功 / 失敗 | var(--success) / var(--destructive) | ui-design 状態表示パターン「通知の送信結果」 |
| 送信待ち | var(--warning) | semantic.warning（amber） |
| マスク文字 / 背景 | var(--pii-masked-color) / var(--pii-masked-bg) | component.pii |
| テーブルヘッダ | var(--background-subtle) | component.table.header_bg |

#### UIロジック

- **状態管理**: 2 層構成（view / component → api client。CLP-012）。画面内状態 = { userNumber, sort, page, loading, summary, rows, totalCount, expandedLoanId, logs(loanId → NotificationLog[]), error }。氏名・メールアドレスはメモリ内状態にのみ保持し永続化しない（LR-025）
- **バリデーション**: 利用者番号は形式（英数字 20 桁以内）のみ。sort は固定値
- **ローディング**: 初回は StatCard と OverdueTable を Skeleton にする。行展開時は NotificationLogTable のみ loading。ページ切替は OverdueTable のみ
- **エラーハンドリング**: api client が HTTP エラーを統一エラー型に正規化（LR-027）。403 → 「この機能は司書のみ利用できます」、404（通知記録取得時に貸出が無い）→ 行内に「記録なし」、5xx / タイムアウト → Alert（destructive）+ 再試行
- **個人情報**: メールアドレスは PiiMaskedText で既定マスク。コンソールログ・エラー収集に氏名・連絡先・通知本文を含めない（CLR-009）。通知本文は画面に表示しない

- **表示ラベル変換**: API enum は FE 側で日本語ラベルに変換して表示する。sendResult: PENDING → 「送信待ち」/ SUCCEEDED → 「送信済み」/ FAILED → 「失敗（理由）」/ SKIPPED → 「スキップ」、notificationType: RETURN_NOTICE → 「返却通知」/ REMINDER → 「リマインド」/ OVERDUE_NOTICE → 「督促」、status: OVERDUE → 「延滞」（LoanStatusBadge）

#### 操作フロー

1. 司書がサイドバー「予約・延滞状況 > 延滞・督促状況」を選ぶ
2. 既定条件（全利用者・返却期限の古い順・1 ページ目）で API を呼び、Skeleton を表示する
3. 応答後に StatCard 3 枚と OverdueTable、Pagination を描画する
4. 行の「通知記録」を展開すると通知記録 API を呼び NotificationLogTable を行下に表示する
5. 行の利用者番号を選ぶと窓口利用状況照会画面（`/staff/users/{userNumber}/status`）へ遷移する。戻り先の条件は URL クエリで保持
6. 行の「返却受付」を選ぶと返却受付画面（`/staff/returns/new?loanId=`）へ遷移する
7. 送信結果が「失敗」の行は理由コードの説明をツールチップで示す（再送は運用手順。画面からの再送機能は設けない）

## コンポーネント設計

### OverduesPage

- **ベースコンポーネント**: PortalShell（staff）+ StatCard + Input + OverdueTable + NotificationLogTable + Pagination + Skeleton + EmptyState + Alert
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | initialFilter | { userNumber?: string; sort?: 'dueDate' \| 'overdueDays' \| 'lastNotice'; page?: number } | No | URL クエリから復元した初期条件 |
  | today | string | Yes | 延滞日数表示の基準日（YYYY-MM-DD） |
- **状態**: userNumber / sort / page / loading / summary / rows(OverdueRow[]) / totalCount / expandedLoanId / logs / error
- **イベント**: onFilterChange、onSortChange、onPageChange、onExpand(loanId)、onSelectUser(userNumber)、onReturn(loanId)、onRetry

### OverdueTable（本画面での利用）

- **ベースコンポーネント**: OverdueTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | rows | { loanId: string; book: { bookId: string; title: string }; user: { userNumber: string; name: string; email: string }; loanedOn: string; dueDate: string; overdueDays: number; latestNotice?: { notificationId: string; sentAt?: string; sendResult: 'PENDING' \| 'SUCCEEDED' \| 'FAILED' \| 'SKIPPED'; failureReason?: string }; noticeCount: number }[] | Yes | API の items |
  | today | string | Yes | DueDateIndicator の基準日 |
  | loading | boolean | No | true で Table（loading） |
  | expandedLoanId | string | No | 展開中の行 |
  | onExpand / onSelectUser / onReturn | function | No | 行操作 |
- **状態**: なし
- **イベント**: onExpand、onSelectUser、onReturn。送信結果セルは 成功 = success + 「送信済み」、失敗 = destructive + 「失敗（理由）」、送信待ち = warning、通知なし = neutral「未送信」

### NotificationLogTable（本画面での利用）

- **ベースコンポーネント**: NotificationLogTable（design-event.yaml domain）
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | logs | { notificationId: string; notificationType: 'RETURN_NOTICE' \| 'REMINDER' \| 'OVERDUE_NOTICE'; recipientEmail: string; requestedOn: string; sentAt?: string; sendResult: string; failureReason?: string }[] | Yes | 貸出に紐づく通知記録（新しい順） |
  | loading | boolean | No | 取得中 |
- **状態**: なし
- **イベント**: なし。送信先は PiiMaskedText（email）で描画

## ティア完了条件（BDD）

```gherkin
Feature: 延滞一覧を参照する - 司書向けフロントエンド

  Scenario: 延滞一覧を表示する
    Given 司書「S-0001」がログイン済みで、today が 2026-09-03 である
    And API GET /api/v1/loans?status=OVERDUE&include=latestNotice&sort=dueDate&page=1&pageSize=20 が summary {overdueCount: 3, noticeFailedCount: 1, noticePendingCount: 0}、items 3 件、totalCount 3 を返す
    And items[0] が loanId=L-2001, dueDate=2026-08-30, overdueDays=4, user.email=taro@example.com, latestNotice.sendResult=SUCCEEDED である
    When /staff/overdues を開く
    Then StatCard「延滞件数」に「3 件」、「督促失敗」に「1 件」が destructive 強調で表示される
    And OverdueTable の 1 行目に DueDateIndicator「2026/08/30（4 日超過）」と送信結果「送信済み」が表示される
    And メールアドレスは「t***@example.com」のようにマスク表示される

  Scenario: 行を展開して通知記録を表示する
    Given 司書「S-0001」が /staff/overdues を表示している
    And API GET /api/v1/loans/L-2001/notifications が 3 件を返す
    When 貸出 L-2001 の行の「通知記録」を選ぶ
    Then 行の下に NotificationLogTable が表示され 3 行が新しい順に並ぶ

  Scenario: 延滞がなければ EmptyState を表示する
    Given 司書「S-0001」がログイン済みである
    And API が summary {overdueCount: 0, noticeFailedCount: 0, noticePendingCount: 0}、items=[] を返す
    When /staff/overdues を開く
    Then EmptyState「延滞中の貸出はありません」が表示され Pagination は表示されない
```

## 共通コンポーネント参照

正本: `_cross-cutting/ux-ui/common-components.md`（略称: S-延滞一覧）

| 共通コンポーネント | インポートパス | Props マッピング（UC 側の値 → Props） |
|------------------|---------------|-------------------------------------|
| StaffLayout | `@/components/common/StaffLayout` | activeGroup = 'reservations'、activeItem = 'overdues' |
| PageHeader | `@/components/common/PageHeader` | title = 「延滞・督促状況」、notices = ErrorAlert |
| StatCardGroup | `@/components/common/StatCardGroup` | items = [{key:'overdue', label:「延滞件数」, value: summary.overdueCount, unit:「件」}, {key:'failed', label:「督促失敗」, value: summary.noticeFailedCount, tone:'destructive'}, {key:'pending', label:「督促待ち」, value: summary.noticePendingCount}]、loading = loading |
| KeywordSearchInput | `@/components/common/KeywordSearchInput` | value = userNumber、onSubmit = onFilterChange、placeholder = 「利用者番号で絞り込み」、maxLength = 20、disabled = loading |
| PaginatedListFrame | `@/components/common/PaginatedListFrame` | filter = KeywordSearchInput、summary = StatCardGroup、page = page、totalCount = totalCount、onPageChange = onPageChange、loading / error / empty / onRetry、skeleton = { variant:'table' }、emptyState = { title: 「延滞中の貸出はありません」 }、children = OverdueTable |
| AsyncStateView | `@/components/common/AsyncStateView` | PaginatedListFrame 内部で利用（初回は StatCard 側は StatCardGroup.loading で card × 3） |
| ErrorAlert | `@/components/common/ErrorAlert` | error = 正規化済み error、onRetry = onRetry、audience = 'staff'（403 → 「この機能は司書のみ利用できます」） |
| CollapsibleSection | `@/components/common/CollapsibleSection` | title = 「通知記録」、open = expandedLoanId === row.loanId、onToggle = onExpand(loanId)、count = row.noticeCount、children = NotificationLogTable（404 は行内「記録なし」） |
| CounterHandoffActions | `@/components/common/CounterHandoffActions` | 行操作: actions = ['return']、bookId = row.book.bookId（onReturn → `/staff/returns/new?bookId=`）。利用者番号リンクは `/staff/users/{userNumber}/status` へ returnQuery を引き継いで遷移 |

使用する共通 hooks:

- `useUrlQueryState`（`@/components/common/hooks/useUrlQueryState`）: userNumber / sort / page ⇄ URL クエリ
- `usePiiReveal`（`@/components/common/hooks/usePiiReveal`）: OverdueTable / NotificationLogTable 内 PiiMaskedText（email）の行別開示状態
- `useDelayedLoading`: AsyncStateView 内部（0.4 秒遅延 Skeleton）
