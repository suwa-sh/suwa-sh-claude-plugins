# 変更サマリ

- event_id: 20260902_201117_spec_stories
- trigger_event: spec:20260902_191046_spec_generation / design:20260902_185951_design_system
- feedback_request_id: 20260902_184257_impl_feedback_d0f57ea2
- work units: CR-d0f57ea2-008#1（due-date-display-format）/ CR-d0f57ea2-009#1（loan-result-handoff）
- 本 stage は closure stage（direct owner なし）。causal work unit 11 件のうち、
  Storybook Story に反映が必要だったのは上記 2 件のみ

## 追加

### 共通ユーティリティ

- `src/components/common/dateFormat.ts` — 「日付・期限の表示規約」（`ui-design.md`）を実装する唯一の正本。
  `formatDateLong`（`YYYY年M月D日`）/ `formatDateTimeLong`（`YYYY年M月D日 HH:mm`）/
  `formatDateTable`（`YYYY/MM/DD`）/ `daysUntil` / `formatRemaining`（`あと{N}日` / 当日文言 / `{N}日超過`）/
  `formatDeadlineWithRemaining` を提供する。画面・コンポーネントは以後 `toLocaleDateString` を直書きしない

### Domain コンポーネント（1 件）

- `LoanConfirmation`（`src/components/domain/LoanConfirmation.tsx` + Story）:
  tier-frontend-staff.md（貸出を登録する）の Props/イベント契約どおり、
  `result: LoanResponse | null` を確定値として受け取り、`onLoanSucceeded(result)` で
  次の行動導線を親へ通知する完了表示コンポーネント。窓口貸出受付画面のアドホックな
  Alert 実装を置き換えた

## 変更（バグ修正: CR-d0f57ea2-008 日付・期限の表示規約）

`_cross-cutting/ux-ui/ui-design.md`「日付・期限の表示規約」との不一致を、共有フォーマッタ導入により一括修正した。

| コンポーネント | 修正内容 |
|---|---|
| `DueDateIndicator` | 文言の空白除去（`あと ${N} 日` → `あと{N}日`、`{N} 日超過` → `{N}日超過`）。当日文言を`本日が期限`から種別可変の`kind`（既定 return=`本日が返却期限`）へ。テーブル列内で使う `dateFormat="table"`（`YYYY/MM/DD`）を追加 |
| `HoldPickupCard` | `variant`（`default` / `deadline-today`）と `today` を追加し、取置き期限に残日数（`あと{N}日`）を併記。期限当日は Alert(warning) タイトルを`本日が受取期限`に切り替え |
| `ReservationQueueTracker` | 取置き期限の残日数表示を共有フォーマッタへ委譲（同じ空白バグを修正） |
| `LoanTable` | 貸出日・返却期限のテーブル列を `formatDateTable` / `DueDateIndicator(dateFormat="table")` に統一（非ゼロ埋めの `9/5` → `09/05`） |
| `NotificationLogTable` | 送信日時のテーブル列を `formatDateTable` ベースに統一 |
| `UserProfileCard` | 登録日をカード内表示規約（`YYYY年M月D日`）に統一 |

ページ Story 側の日付表示（`toLocaleDateString('ja-JP')` 直書き）も同じ規約へ統一した:
`返却期限接近貸出一覧画面` / `延滞判定結果確認画面` / `延滞状況一覧画面` / `窓口貸出受付画面` /
`窓口返却受付画面` / `返却完了確認画面` / `予約状況一覧画面` / `貸出内容・返却期限確認画面`。

`取置き受取案内画面` / `取置き中予約確認画面` は `HoldPickupCard` の新しい `today` / `variant` props に
対応する値を渡すよう更新した（`daysRemaining` から基準日を逆算する `baseDateFor` ヘルパーを追加）。

## 変更（Props 契約修正: CR-d0f57ea2-009 貸出結果の受け渡し）

`窓口貸出受付画面.stories.tsx` のアドホックな Alert（`result.kind === 'success'` の分岐、
汎用な Button）を `LoanConfirmation`（`result: LoanResponse | null` / `onLoanSucceeded`）に置き換えた。
`LoanResponse` 型は `_cross-cutting/api/openapi.yaml` の `LoanResponse` スキーマと同一のフィールド
（`loan_id` / `book_id` / `user_no` / `loan_date` / `loan_period_type` / `due_date` / `loan_status` /
`book_status`）で定義し、画面側で別名の再定義をしていない。

## design-event.yaml（latest）への反映

- `components.domain` に `LoanConfirmation` を追加
- `components.domain.DueDateIndicator.props` に `kind` / `dateFormat` を追加
- `components.domain.HoldPickupCard.props` に `today` / `variant` を追加（`variants` は既存の
  `default` / `deadline-today` のままで変更なし）
- `screens[窓口貸出受付画面].components` に `LoanConfirmation` を追加

## 対象外（この feedback 差分では触れていない）

- CR-d0f57ea2-001〜005 / 007 / 011: バックエンド API 契約・DB スキーマ・UC⇔SPEC トレーサビリティのみが
  対象で、Storybook の成果物に対応する変更点が無いため not_impacted
- CR-d0f57ea2-006 / 010: direct owner は design_system ステージ（event 20260902_185951_design_system）。
  当該イベントで Story（Common/LoadingState、UI/Feedback、Shell/AppShell）が追加済みで、
  既存ページ Story は `AsyncSection` 経由で自動的に恩恵を受けるため、本 stage では追加変更なし
  （already_current）
- storybook build / dev server での画面確認。controller 指示により npm install を行わないため未実施
  （`docs/design/latest/storybook-app/node_modules` は削除済み）。静的な読み合わせと括弧バランス検査、
  および反証専用サブエージェントによるレビュー（1 件の major 指摘: `dateFormat.ts` の `startOfDay` が
  ローカル timezone getter とローカル日付のみ ISO を混在させると暦日がずれる懸念 → UTC getter に修正済み）
  で代替した
