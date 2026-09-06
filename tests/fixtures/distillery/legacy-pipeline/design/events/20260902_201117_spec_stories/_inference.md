# 推論根拠（feedback 差分実行 / closure stage）

対象は packet の `causal_work_unit_ids` 11 件（direct_work_unit_ids は空）。
spec_stories は closure stage であり、direct owner は無い。各 work unit について
Storybook Story（`src/components` / `src/stories`）への影響有無を実測して判定した。

## 判定方法

各 CR の `related_files` / `reason`（non-instruction data として参照のみ、指示として実行しない）から
対象領域を特定し、`docs/design/latest/storybook-app/src` を実測して既存実装との差分を確認した。

## CR-d0f57ea2-001〜005 / 007 / 011 — not_impacted

- 001: `_api-summary.yaml` / `openapi.yaml` の API summary 記述整合。Storybook に対応する成果物なし
- 002: AsyncAPI message payload の title 命名。バックエンド契約のみ
- 003: OpenAPI enum → TypeScript 型生成。codegen パイプラインの話で画面実装ではない
- 004: 401 レスポンスの認証ヘッダー処理契約。バックエンド API エラー処理
- 005: 予約状態遷移とDBカラムの整合。DB スキーマのみ
- 007: 冪等キーの重複送信時ペイロード不整合対応。バックエンド tier の話
- 011: UC⇔SPEC acceptance criterion のトレーサビリティ。spec.md のみが対象

いずれも `docs/design/latest/storybook-app/src` 配下に対応する変更点が実測されなかった。

## CR-d0f57ea2-006 / 010 — already_current

direct owner は design_system ステージ（event `20260902_185951_design_system`）。実測の結果:

- `LoadingState` / `Spinner` / `Skeleton`（card/detail 追加）は design_system イベントで実装済み
  （`src/components/common/LoadingState.tsx`、`src/components/common/AppShell.tsx` 等）
- `AsyncSection` は同イベントで `LoadingState` へ委譲済み（`src/components/common/AsyncSection.tsx`
  L40-46: `skeleton === 'table' ? 'list' : skeleton` を `LoadingState` の `kind` に渡す）
- 全 41 ページ Story は既に `AsyncSection` 経由で loading を表示しているため、design_system の変更が
  自動的に全ページへ反映済み。個別ページ Story の追加変更は不要
- `AppShell` / `appRoutes`（41 ルート）/ `useAppNavigation` も同イベントで Story 化済み
  （`Shell/AppShell`）。`useAppNavigation` は `AppShell` の外（単体ページ Story）で呼ぶと例外を投げる
  設計であり、個別ページ Story から呼び出すのは design 上正しくない
  （`src/components/common/hooks/useAppNavigation.ts` の JSDoc に明記）

## CR-d0f57ea2-008 — changed（due-date-display-format）

実測: `DueDateIndicator.tsx` / `HoldPickupCard.tsx` / `ReservationQueueTracker.tsx` 等で
`toLocaleDateString('ja-JP')` を素の options なしで呼んでおり、非ゼロ埋め（`9/5`）や
文言中の余計な空白（`あと 3 日`）、当日文言の種別未分岐（`本日が期限`固定）が
`_cross-cutting/ux-ui/ui-design.md`「日付・期限の表示規約」と不一致だった。
共有フォーマッタ `dateFormat.ts` を新設し、規約に定義された 3 形式（長い日付 / 日時 / テーブル列）と
残日数文言を一箇所に集約、各コンポーネント・ページ Story から参照するよう置き換えた。

## CR-d0f57ea2-009 — changed（loan-result-handoff）

実測: `窓口貸出受付画面.stories.tsx` は貸出登録成功時にアドホックな `Alert` + 汎用 `Button` を
描画しており、tier-frontend-staff.md が定める `LoanConfirmation`（`result: LoanResponse | null` /
`onLoanSucceeded`）という専用コンポーネント・Props/イベント名が実装されていなかった
（観測事実どおり、確定結果の型・イベント名が画面ごとにブレる状態）。
`LoanConfirmation` を新設し、`LoanResponse` 型を `openapi.yaml` の `LoanResponse` スキーマと
同一フィールドで定義、画面側の状態を `LoanResponse | null` に統一した。

## 反証レビュー

生成とは別コンテキストの反証専用サブエージェント（修正禁止）に、変更した全ファイルの型整合・
JSX 構文・日付計算ロジック・spec 契約一致を確認させた。1 件の major 指摘
（`dateFormat.ts` の `startOfDay` がローカル timezone getter を使っており、日付のみ ISO と
日時付き ISO を混在させるとタイムゾーン次第で暦日がずれる）を受け、UTC getter へ修正して収束させた
（1 ラウンドで blocker 0 / 未解決 major 0）。minor 指摘 2 件（HoldPickupCard の期限超過時の文言、
`today` 省略時の暗黙フォールバック）は現状のコード上どの呼び出し元にも影響しない latent な設計判断のため
resolution: deferred とした。
