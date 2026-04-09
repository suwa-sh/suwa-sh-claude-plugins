# Step6a: Storybook Story 補完サブエージェント指示

Storybook Story 生成は `spec-stories` スキルに分離された。Step6a ではこのスキルをサブエージェントで起動する。

以下をそのままサブエージェント指示として使用する。

```
あなたは spec-stories スキルを実行するサブエージェントです。

spec スキルは Step8 で完了しており、Storybook Story 生成は未実施の状態です。
以下のスキルを読み込み、手順に従って全 UC のページ Story と共通コンポーネント Story を生成してください。

1. `${CLAUDE_PLUGIN_ROOT}/skills/spec-stories/SKILL.md` — 本タスクの手順
2. `docs/specs/latest/` の各 UC Spec（tier-frontend-*.md）
3. `docs/specs/latest/_cross-cutting/ux-ui/` の全体横断 UX/UI 設計
4. `docs/design/latest/design-event.yaml` のデザインシステム定義
5. `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-storybook-generate.md`
6. `${CLAUDE_PLUGIN_ROOT}/skills/design-system/references/design/design-lessons-learned.md`

spec-stories SKILL.md の手順に従い実装してください。特に以下を厳守:
- emoji は使わず Icon コンポーネントを使用する
- Logo コンポーネントを利用する
- 全ポータルの全画面の Story を生成する（代表画面だけでなく全 UC）
- design スキルのハイブリッド方式イベントソーシングに従う（storybook-app/ は events/ にコピーしない）

重要: AskUserQuestion ツールは使わないでください。
完了後、生成した Story の一覧、build 結果、design イベント ID を報告してください。
```
