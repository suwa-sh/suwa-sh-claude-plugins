# 変更内容 — 20260904_113742_spec_stories

基点: `20260903_041812_design_system`（screens 24 件・components.ui 15・components.domain 23 を宣言済み）

## 追加（design-event.yaml への宣言差分）

| 区分 | 内容 |
|---|---|
| components.common | 16 件（PatronLayout, StaffLayout, PageHeader, AsyncStateView, ErrorAlert, NoticeAlert, PaginatedListFrame, KeywordSearchInput, ScopeToggle, StatCardGroup, CollapsibleSection, EntityFormPage, ConfirmPage, SubmitButton, BackLink, CounterHandoffActions, PeriodReportFrame）。実装済みだが前イベントで未宣言だったため本イベントで宣言する |
| storybook.categories | Common, Pages を追加 |

## 実装（storybook-app/ latest/ のみ。events/ には含めない）

- 共通コンポーネント Story 16 件（`src/stories/data/`, `src/stories/feedback/`, `src/stories/forms/`, `src/stories/layout/`, `src/stories/navigation/`）は既に実装済みであることを確認した（本イベントでの新規追加ではない）
- ページ Story 24 件を `src/stories/Pages/{利用者ポータル|司書ポータル}/{画面名}.stories.tsx` に新規追加した（design-event.yaml の screens で宣言済みの story タイトル・variants に一致）

| ポータル | 画面（UC） | Story ファイル | variants |
|---|---|---|---|
| patron | 蔵書検索画面（書籍を検索する） | 利用者ポータル/蔵書検索画面.stories.tsx | Default, Empty, Loading |
| patron | 書籍詳細・在庫状況画面（書籍詳細を参照する） | 利用者ポータル/書籍詳細・在庫状況画面.stories.tsx | Available, OnLoan, Reserved, Loading |
| patron | 予約申込画面（予約を登録する） | 利用者ポータル/予約申込画面.stories.tsx | OnLoan, AlreadyAvailable, Submitting |
| patron | 予約取消画面（予約を取り消す） | 利用者ポータル/予約取消画面.stories.tsx | Default, Submitting |
| patron | マイ貸出履歴画面（貸出履歴を参照する） | 利用者ポータル/マイ貸出履歴画面.stories.tsx | Default, WithOverdue, Empty |
| patron | マイ予約状況画面（予約状況を参照する） | 利用者ポータル/マイ予約状況画面.stories.tsx | Default, Notified, Empty |
| staff | 蔵書一覧画面（書籍一覧を参照する） | 司書ポータル/蔵書一覧画面.stories.tsx | Default, Empty, Loading |
| staff | 書籍登録画面（書籍を登録する） | 司書ポータル/書籍登録画面.stories.tsx | Default, ValidationError, Submitting |
| staff | 書籍編集画面（書籍を編集する） | 司書ポータル/書籍編集画面.stories.tsx | Default, Submitting |
| staff | 書籍削除確認画面（書籍を削除する） | 司書ポータル/書籍削除確認画面.stories.tsx | Deletable, Blocked |
| staff | 窓口蔵書検索画面（書籍を検索する） | 司書ポータル/窓口蔵書検索画面.stories.tsx | Default, Empty |
| staff | 利用者登録画面（利用者を登録する） | 司書ポータル/利用者登録画面.stories.tsx | Default, ValidationError, Registered |
| staff | 利用者編集画面（利用者を編集する） | 司書ポータル/利用者編集画面.stories.tsx | Default, Submitting |
| staff | 利用者削除確認画面（利用者を削除する） | 司書ポータル/利用者削除確認画面.stories.tsx | Deletable, Blocked |
| staff | 利用者一覧画面（利用者一覧を参照する） | 司書ポータル/利用者一覧画面.stories.tsx | Default, Empty, Loading |
| staff | 貸出受付画面（貸出を登録する） | 司書ポータル/貸出受付画面.stories.tsx | Input, Allowed, Denied, Done |
| staff | 返却受付画面（返却を登録する） | 司書ポータル/返却受付画面.stories.tsx | Input, Found, FoundWithReservation, Done |
| staff | 返却通知送信確認画面（返却通知を送信する） | 司書ポータル/返却通知送信確認画面.stories.tsx | Default, Sent, Failed |
| staff | 書籍別予約状況画面（予約一覧を参照する） | 司書ポータル/書籍別予約状況画面.stories.tsx | Default, Empty |
| staff | 延滞・督促状況画面（延滞一覧を参照する） | 司書ポータル/延滞・督促状況画面.stories.tsx | Default, Empty, Loading |
| staff | 窓口利用状況照会画面（利用者の利用状況を参照する） | 司書ポータル/窓口利用状況照会画面.stories.tsx | Default, NotFound |
| staff | 在庫状況一覧画面（在庫状況一覧を参照する） | 司書ポータル/在庫状況一覧画面.stories.tsx | Default, Loading |
| staff | 人気書籍ランキング画面（人気書籍ランキングを参照する） | 司書ポータル/人気書籍ランキング画面.stories.tsx | Default, Loading, Empty |
| staff | 期間別貸出統計画面（期間別貸出統計を参照する） | 司書ポータル/期間別貸出統計画面.stories.tsx | Monthly, Daily, Loading |

新規ドメイン/UI コンポーネントの追加は無し（既存コンポーネントの組み合わせのみで全 24 画面を構成）。

## 検証

- `npx tsc --noEmit -p .`（storybook-app/）: エラーなし
- `npx storybook build`: 成功（`storybook-static/` 生成）
- emoji 使用チェック: 検出なし
- 全ページ Story の `meta.title` が design-event.yaml screens[].story と完全一致することを確認済み

## todo.md 登録

なし（confidence: low の確認推奨項目は発生しなかった）
