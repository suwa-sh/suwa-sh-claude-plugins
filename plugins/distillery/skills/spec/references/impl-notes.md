# 実装上の注意事項（実績に基づく）

## subagent 運用

- **1 subagent あたり UC 上限は 8-10**。それ以上はコンテキスト上限で途中停止するリスクがある
- 途中停止した場合は未生成 UC を新しい subagent で補完する
- Step4 は入力が大量（全 UC の _api-summary.yaml）のため、機能別に複数 subagent に分割する

## Step4.5（共通コンポーネント UC フィードバック）は必須

- common-components.md 生成後に UC の tier-frontend-*.md へのフィードバックを**省略してはならない**
- 省略すると UC Spec と共通コンポーネント設計が乖離し、Storybook 実装時に不整合が発生する

## Step9: 共通コンポーネント Story を先に作る

- ページ Story 生成の**前に** common-components.md の共通コンポーネント（StatusBadge, EmptyState, LoadingSkeleton, ErrorBanner, ConfirmActionModal 等）を TSX + Story として実装する
- ページ Story から共通コンポーネントを参照できるようにする

## YAML ファイル生成

- spec-event.yaml 等の YAML ファイルは bash の echo/heredoc ではなく、Write ツールで直接生成する
- YAML の配列は `["a", "b"]`（JSON 記法）ではなく `- "a"` / `- "b"` のネイティブ YAML 形式を使う
