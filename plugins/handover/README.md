# handover

Claude Code のセッション間でコンテキスト（作業状況・意思決定・教訓）を自動引き継ぎするプラグイン。

## 概要

Claude Code はコンテキストウィンドウの上限に達すると `/compact` でコンパクションを行うが、
その際にセッションの詳細なコンテキストが失われる。
このプラグインは、コンパクション前に自動で引き継ぎドキュメント（HANDOVER.md）を生成し、
次のセッション開始時にコンテキストとして注入することで、セッション間の文脈断絶を解消する。

## インストール

```
/plugin marketplace add suwa-sh/suwa-sh-claude-plugins
/plugin install handover@suwa-sh-claude-plugins
```

## 前提条件

| ツール | 用途 | インストール |
|-------|------|-------------|
| claude CLI | `claude -p` パイプ実行 | `npm install -g @anthropic-ai/claude-code` |
| jq | トランスクリプトのフィルタリング | `brew install jq` / `apt install jq` |

## 重要: .gitignore 設定

プラグインが生成する `HANDOVER.md` は一時ファイルのため、
各プロジェクトの `.gitignore` に以下を追加してください:

```
HANDOVER.md
```

## 使い方

### 自動引き継ぎ（推奨）

プラグインをインストールするだけで動作します:

1. `/compact` 実行時（または自動コンパクション時）に PreCompact hook が HANDOVER.md を自動生成
2. 次のセッション開始時に SessionStart hook が HANDOVER.md をコンテキストに自動注入
3. 注入後にファイルは自動削除される

### 手動引き継ぎ

作業の区切りで明示的に引き継ぎドキュメントを生成:

```
/handover
/handover 特にXXXの設計判断を詳しく残してほしい
```

## 3つの経路

| 経路 | トリガー | 生成者 | 用途 |
|------|---------|--------|------|
| `/handover` スキル | 手動実行 | メイン Agent | 作業の区切りで明示的に引き継ぎ |
| PreCompact hook | `/compact` 実行時に自動 | `claude -p sonnet` | コンパクション前の自動引き継ぎ |
| SessionStart hook | セッション開始時に自動 | - | HANDOVER.md をコンテキストに注入 |

## コスト

| 処理 | 時間 | コスト |
|------|------|--------|
| PreCompact hook（自動生成） | 30〜60秒 | ~$0.16 |
| SessionStart hook（注入） | <1秒 | - |

## ドキュメント

詳細な設計ドキュメントは [docs/](./docs/) を参照:

- [構造（C4 Model）](./docs/structure.md)
- [データモデル](./docs/data-model.md)
- [利用方法](./docs/usage.md)
- [運用方法](./docs/operations.md)
- [ADR](./docs/adr.md)
