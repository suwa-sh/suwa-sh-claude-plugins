# cc — Claude Code 運用支援

Claude Code のセッション運用を支援するスキル集（セッション引き継ぎ / リポジトリ起動）。

## スキル

### `cc:handover` — セッション引き継ぎ

Claude Code のセッション間でコンテキスト（作業状況・意思決定・教訓）を自動引き継ぎする。

コンパクション前や作業の区切りで、現在の会話コンテキストから引き継ぎドキュメント（`HANDOVER.md`）を生成。`PreCompact` / `SessionStart` フックにより、コンパクション時の自動引き継ぎにも対応する。

| 経路 | トリガー | 生成者 | 用途 |
|------|---------|--------|------|
| `/cc:handover` スキル | 手動実行 | メイン Agent | 作業の区切りで明示的に引き継ぎ |
| `PreCompact` hook | `/compact` 実行時に自動 | `claude -p sonnet` | コンパクション前の自動引き継ぎ |
| `SessionStart` hook | セッション開始時に自動 | - | `HANDOVER.md` をコンテキストに注入 |

詳細な設計ドキュメントは [docs/](./docs/) を参照:

- [構造（C4 Model）](./docs/structure.md)
- [データモデル](./docs/data-model.md)
- [利用方法](./docs/usage.md)
- [運用方法](./docs/operations.md)
- [ADR](./docs/adr.md)

#### コスト

| 処理 | 時間 | コスト |
|------|------|--------|
| `PreCompact` hook（自動生成） | 30〜60秒 | ~$0.16 |
| `SessionStart` hook（注入） | <1秒 | - |

#### 重要: `.gitignore` 設定

プラグインが生成する `HANDOVER.md` は一時ファイルのため、各プロジェクトの `.gitignore` に以下を追加してください:

```
HANDOVER.md
```

### `cc:launch-claude` — リポジトリでセッション起動

ghq 管理リポジトリをキーワードで検索し、新しい Ghostty スプリットに Claude Code セッションを起動する。スラッシュコマンドを渡して起動時に自動実行も可能（例: `pkm /deep-research テーマ`）。`--model` / `--agent`（自然文でも可）でモデルとエージェントペルソナを指定できる（例: `pkm を fable の marketer で開いて` → `--model fable --agent marketer`）。

## インストール

```
/plugin install cc@suwa-sh-claude-plugins
```

### npx skills 経由（Claude Code 以外のエージェントにも）

```bash
npx skills add suwa-sh/suwa-sh-claude-plugins --skill cc:launch-claude -a claude-code
npx skills add suwa-sh/suwa-sh-claude-plugins --skill cc:handover     -a claude-code
```

- `cc:launch-claude` … 依存チェックスクリプト同梱で npx skills 配布に対応
- `cc:handover` … `/cc:handover` の手動実行は可能。ただし**自動引き継ぎ（hooks）は Claude Code プラグイン形式が必要**

## 前提条件

| ツール | 用途 | 必須スキル | インストール |
|-------|------|-----------|-------------|
| claude CLI | `claude -p` パイプ実行（自動引き継ぎ） | `cc:handover` | `npm install -g @anthropic-ai/claude-code` |
| jq | トランスクリプトのフィルタリング | `cc:handover` | `brew install jq` |
| macOS | AppleScript 経由のGhostty操作 | `cc:launch-claude` | — |
| [Ghostty](https://ghostty.org/) | ターミナルエミュレータ（起動済み） | `cc:launch-claude` | — |
| [ghq](https://github.com/x-motemen/ghq) | リポジトリ管理 | `cc:launch-claude` | `brew install ghq` |
| zsh | シェル | `cc:launch-claude` | — |

## 構成

```
cc/
├── .claude-plugin/
│   └── plugin.json
├── hooks/                        # cc:handover の自動引き継ぎフック
│   ├── hooks.json
│   ├── pre_compact.sh
│   └── session_start.sh
├── docs/                         # cc:handover の設計ドキュメント
│   ├── adr.md
│   ├── data-model.md
│   ├── operations.md
│   ├── structure.md
│   └── usage.md
└── skills/
    ├── handover/
    │   └── SKILL.md
    └── launch-claude/
        ├── SKILL.md
        └── scripts/
            └── check_deps.sh
```

## ライセンス

[MIT License](../../LICENSE)
