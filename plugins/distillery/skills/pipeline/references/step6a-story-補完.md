# Step6a: Storybook Story 補完サブエージェント指示

以下をそのままサブエージェント指示として使用する。

```
あなたは Spec Step9（Storybook Story 生成）の補完エージェントです。

spec スキルの Step9 が未完了のため、Storybook Story の生成を実行してください。

以下のファイルを読んでください:
1. `${CLAUDE_PLUGIN_ROOT}/skills/spec/SKILL.md` の Step9 セクション
2. `docs/specs/latest/` の各UC Spec（tier-frontend-*.md）
3. `docs/specs/latest/_cross-cutting/ux-ui/` の全体横断UX/UI設計
4. `docs/design/latest/design-event.yaml` のデザインシステム定義
5. `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-storybook-generate.md`
6. `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-lessons-learned.md`

Step9 の手順に従い実装してください。特に以下を厳守:
- emoji は使わず Icon コンポーネントを使用する
- Logo コンポーネントを利用する
- 全ポータルの全画面の Story を生成する（代表画面だけでなく全UC）
- design スキルのハイブリッド方式イベントソーシングに従う:
  1. `docs/design/latest/storybook-app/` で直接 Story を追加・実装する（storybook-app/ は latest/ でのみ管理）
  2. `npx storybook build` でビルド検証する
  3. ビルド成功後、`date '+%Y%m%d_%H%M%S'` でイベント ID を取得
  4. `docs/design/events/{timestamp}_spec_stories/` を作成し、以下を記録する:
     - `design-event-diff.yaml` — screens/components の追加分のみ（差分）
     - `_changes.md` — 追加した共通コンポーネント・ページ Story の一覧
     - `_inference.md`、`source.txt`
  5. `docs/design/latest/design-event.yaml` に差分をマージする（screens/components を追加）
  6. `docs/design/latest/design-event.md` を再生成する
  7. **storybook-app/ は events/ にコピーしない**（全量再ビルド対象のため。design-event.yaml から再現可能）

重要: AskUserQuestion ツールは使わないでください。
完了後、生成した Story の一覧、build 結果、design イベントIDを報告してください。
```
