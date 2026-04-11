---
name: spec-stories
description: >
  spec スキルの後段で、UC Spec とデザインシステムから Storybook の Story（ページ単位 + 共通コンポーネント）を生成する独立スキル。
  spec スキル本体は Step8 で完了し、Storybook Story 生成は本スキルで別途実施する。
  「Storybook Story 生成」「spec から Story 補完」「UC ページ Story 作成」「Story 補完」などで発動。
---

# Spec Stories (Storybook Story 生成)

spec スキル（Step1〜Step8）で確定した UC Spec・全体横断 UX/UI 設計と、design-system スキルで構築された Storybook プロジェクトを入力として、全 UC のページ Story と UC 固有コンポーネント Story を生成する。

spec スキルの Step9 として実装されていたものを独立スキルに分離したもの。Story 生成はコンテキスト消費が大きく、spec 本体と同一コンテキストで実行すると中断しやすいため、独立サブエージェントとして実行する。

## 前提条件

- `docs/specs/latest/` が存在し、Presentation 系ティア（tier-frontend-*.md）が生成済みであること
- `docs/specs/latest/_cross-cutting/ux-ui/` の全体横断 UX/UI 設計（ux-design.md / ui-design.md / common-components.md）が存在すること
- `docs/design/latest/design-event.yaml` と `docs/design/latest/storybook-app/` が存在すること

## 入力

- `docs/specs/latest/{業務名}/{BUC名}/{UC名}/tier-{tier_id}.md`（Presentation 系ティア）— コンポーネント設計・画面仕様
- `docs/specs/latest/_cross-cutting/ux-ui/ux-design.md` — ユーザーフロー・インタラクション設計
- `docs/specs/latest/_cross-cutting/ux-ui/ui-design.md` — レイアウトパターン・レスポンシブ戦略
- `docs/specs/latest/_cross-cutting/ux-ui/common-components.md` — 共通コンポーネント設計
- `docs/design/latest/design-event.yaml` — デザインシステム（トークン・コンポーネント）
- `docs/design/latest/storybook-app/` — 既存の Storybook プロジェクト

## 読み込み（design スキルの references）

- `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-storybook-generate.md` — Storybook 生成ルール + emoji→Icon 置換
- `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-lessons-learned.md` — 実装の教訓・品質チェックリスト
- `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-components-generate.md` — コンポーネント仕様生成ルール

## 出力

既存の `docs/design/latest/storybook-app/` に以下を追加する:

- `src/stories/pages/` — UC の画面を再現したページ Story
- `src/stories/components/` — Spec で定義した UC 固有コンポーネントの Story（既存コンポーネントと重複しないもの）

## 手順

1. **共通コンポーネントの実装（最初に実施）**: `_cross-cutting/ux-ui/common-components.md` で定義された共通コンポーネントを TSX + Story として実装する。**ページ Story より先に共通コンポーネントを作る**ことで、ページ Story から参照できる
   - `src/components/common/` に TSX を配置
   - `src/stories/badges/`, `src/stories/feedback/`, `src/stories/modals/`, `src/stories/forms/`, `src/stories/data/` に Story を配置
   - 対象: StatusBadge, EmptyState, LoadingSkeleton, ErrorBanner, ProcessingState, ConfirmActionModal, EntityEditForm, SearchFilterPanel, PaginatedList
   - レイアウト Shell の Story を `src/stories/layout/` に配置（UserPortalShell, OwnerPortalShell, AdminPortalShell）
2. **対象画面の特定**: Presentation 系ティアの tier-{tier_id}.md から画面仕様（URL、コンポーネントマッピング、操作フロー）を収集する
3. **ページ Story の生成（全 UC 必須）**: 各画面を CSF3 形式の Story として実装する
   - design-event.yaml の既存コンポーネント（UI + Domain）を組み合わせて画面を構成する
   - `_cross-cutting/ux-ui/ui-design.md` のレイアウトパターンに従う
   - tier-{tier_id}.md のコンポーネント設計（Props、状態、イベント）を反映する
   - **全ポータルの全画面を生成する**（代表画面だけでなく、tier-frontend-*.md が存在する全 UC のページ Story を作成する）
   - **UC 全数チェック**: `docs/specs/latest/` 配下の Presentation 系ティアを持つ UC を列挙し、対応するページ Story が存在することを検証する。欠落がある場合は追加生成してから次に進む
   - UC 数が多い場合は subagent で業務単位に分割して並列生成する（1 subagent あたり 8-10 UC が上限）
4. **UC 固有コンポーネントの生成**: tier-{tier_id}.md のコンポーネント設計で、design-event.yaml に存在しない新規コンポーネントがあれば追加実装する
5. **画面確認（必須）**: ブラウザツールで目視確認する
   - Storybook dev server を起動 (`cd docs/design/latest/storybook-app && npm run storybook -- --no-open`)
   - 当たり前品質チェック（はみ出し、文字切れ、コントラスト、クリッカブル、色の適用）
   - 問題があれば修正 → 再確認のループ
6. **ビルド検証**: `npx storybook build` でエラーがないことを確認する
7. **design イベント記録（ハイブリッド方式）**: design スキルのイベントソーシングルールに従う。storybook-app/ は全量再ビルド対象のため events/ には含めない:
   - `date '+%Y%m%d_%H%M%S'` でイベント ID を生成
   - `docs/design/events/{event_id}_spec_stories/` を作成し、以下を記録する:
     - `design-event-diff.yaml` — screens/components の追加分のみ（差分）
     - `_changes.md` — 追加した共通コンポーネント・ページ Story の一覧
     - `_inference.md`、`source.txt`
   - `docs/design/latest/design-event.yaml` に差分をマージする（screens/components を追加）
   - `docs/design/latest/design-event.md` を再生成する
   - **storybook-app/ は events/ にコピーしない**（latest/ で直接開発・ビルド済み。design-event.yaml から再現可能）

## 重要なルール

- design スキルの `design-lessons-learned.md` のルールに従う（emoji 禁止、Tailwind v4 色指定、トークン参照等）
- 既存のコンポーネント Story を壊さない — 追加のみ
- **ページ Story の配置パスは `src/stories/Pages/{ポータル名}/{画面名}.stories.tsx` に固定**する
  （大文字 `Pages`。Storybook のカテゴリ構造 `Pages/{ポータル名}/{画面名}` と一致させる）
- pipeline Step6a の判定は大文字小文字を無視する（`find ... -iname "*.stories.tsx" -path "*[Pp]ages*"`）
  ため、大文字でも小文字でも検出されるが、**本スキルの出力は大文字 `Pages` に統一**する
- UC 数の source of truth は `docs/specs/latest/` 配下の UC spec.md 件数
- **Logo コンポーネントを利用する**: design-event.yaml の `brand.logo.variants` で定義された Logo SVG（full, icon, stacked）を、ページのヘッダー・サイドバー・ログイン画面等で積極的に使用する。既存の Logo コンポーネント（`@/components/ui/Logo`）をインポートして配置する
- `_cross-cutting/ux-ui/common-components.md` の共通コンポーネント設計を参照し、ページ間で一貫したレイアウトシェルを使用する
- AskUserQuestion ツールは使わない

## タスク完了時

1. Storybook dev server を**停止する** (`kill $(lsof -t -i :6006)`)
2. ユーザーに以下を報告する:
   - 追加された Storybook Story の一覧（共通コンポーネント + 全ページ）
   - build 結果
   - design イベント ID
   - **Storybook の起動コマンド**:
     ```
     cd docs/design/latest/storybook-app && npm run storybook
     ```
