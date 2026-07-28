# suwa-sh-claude-plugins

Claude Code のカスタムプラグイン集。

## インストール

Claude Code で以下を実行:

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
```

## プラグイン一覧

| プラグイン | 説明 | インストール |
|-----------|------|-------------|
| [cc](./plugins/cc/) | Claude Code 運用支援。セッション間コンテキスト自動引き継ぎ（`cc:handover`）と、ghq管理リポジトリでGhosttyスプリットにClaude Codeセッションを起動（`cc:launch-claude`）の2スキル | `/plugin install cc@suwa-sh-claude-plugins` |
| [distillery](./plugins/distillery/) | 要望テキストから要件定義・アーキ・インフラ・デザインシステム・仕様までを蒸留生成（RDRA/USDM/NFR パイプライン）。[出力サンプル](samples/distillery) | `/plugin install distillery@suwa-sh-claude-plugins` |
| [ddd](./plugins/ddd/) | ドメイン駆動設計の実装常用（値オブジェクト/振る舞いを持ったenum/集約/貧血回避）とアーキ設計（境界づけられたコンテキスト/サブドメイン/コンテキストマップ）の2スキル。増田亨・little_hands・Fowler ベース | `/plugin install ddd@suwa-sh-claude-plugins` |
| [distillery-impl](./plugins/distillery-impl/) | distillery の仕様書を入力に実装を回す実装ハーネス。契約駆動 codegen + 4 段テスト先行（ATDD/UC BDD/tier BDD/TDD）+ tier 並走実装 + 別モデル Verifier の反証 + ファイル駆動の冪等再開 | `/plugin install distillery-impl@suwa-sh-claude-plugins` |

## npx skills でのインストール（Claude Code 以外のエージェントにも）

[vercel-labs/skills](https://github.com/vercel-labs/skills) 経由で、Cursor / Codex / Gemini CLI などでも各スキルを個別に利用できます。

```bash
# 収録スキルを一覧
npx skills add suwa-sh/suwa-sh-claude-plugins --list

# 個別インストール（例: ddd:ddd-tactical-implementation を Claude Code へ）
npx skills add suwa-sh/suwa-sh-claude-plugins --skill ddd:ddd-tactical-implementation -a claude-code

# すべて入れる
npx skills add suwa-sh/suwa-sh-claude-plugins --all
```

`npx skills` は SKILL.md 単位でスキルをコピーします（スキルディレクトリ内の `scripts/` / `references/` も同梱）。一方で hooks 配線やスキル間連携といったプラグイン機構は引き継がれないため、プラグインごとの対応状況は次の通りです。

| プラグイン | npx skills | 備考 |
|-----------|:---------:|------|
| ddd | ✅ 完全対応 | 自己完結（references のみ参照） |
| cc | ⚠️ プラグイン推奨 | `cc:launch-claude` は依存チェックスクリプト同梱で対応。`cc:handover` は `/cc:handover` 手動実行は可能だが、自動引き継ぎ（hooks）は Claude Code プラグイン形式が必要 |
| distillery | ⚠️ プラグイン推奨 | スキル間が `${CLAUDE_PLUGIN_ROOT}` のクロス参照で密結合したパイプラインのため、スキル単位配布では連携が解決できない |
| distillery-impl | ⚠️ プラグイン推奨 | オーケストレータがサブエージェント + skill 呼び出しで各 stage を運転するため、スキル単位配布では連携が解決できない |

> 全機能を使うには、上記「インストール」のプラグイン形式（`/plugin marketplace add`）を推奨します。

## ライセンス

[MIT License](./LICENSE)
