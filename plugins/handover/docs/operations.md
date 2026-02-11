# 運用方法

## ファイル一覧

| ファイル | 役割 |
|---------|------|
| `.claude-plugin/plugin.json` | Plugin マニフェスト |
| `hooks/hooks.json` | hooks 登録（PreCompact, SessionStart） |
| `hooks/pre_compact.sh` | PreCompact hook スクリプト |
| `hooks/session_start.sh` | SessionStart hook スクリプト |
| `skills/handover/SKILL.md` | /handover スキル定義 |

## 冪等性

何度 `/compact` を実行しても安全:

| 制御 | 仕組み |
|------|--------|
| PreCompact hook | 毎回トランスクリプトから再生成（上書き） |
| SessionStart hook | 読み取り後に即削除（再注入なし） |
| HANDOVER.md 不在時 | 両 hook とも exit 0 で正常終了 |

## トラブルシューティング

### PreCompact hook が失敗する

```
PreCompact [hooks/pre_compact.sh] failed
```

**原因1: Prompt is too long**

トランスクリプトが非常に大きい場合（jq フィルタ後も 200k tokens 超）、`claude -p` が失敗する。

→ 現在の jq フィルタ（text + tool_use）で通常は ~35k tokens に収まる。異常に長いセッションでのみ発生しうる。

**原因2: タイムアウト（120秒超過）**

`claude -p sonnet` の応答が遅い場合。

→ `hooks/hooks.json` の `timeout` を増やすことで対応可能（ただしプラグインの hooks.json はユーザーから read-only）。

**原因3: claude CLI が見つからない**

→ `claude` コマンドにパスが通っているか確認。hook はユーザーのシェルプロファイルを読み込まない場合がある。

### HANDOVER.md が生成されない

**確認手順**:

```bash
# 1. jq がインストールされているか
which jq

# 2. プラグインがインストールされているか
# Claude Code で /plugin list を確認
```

### SessionStart で引き継ぎが注入されない

**確認手順**:

1. HANDOVER.md が cwd に存在するか確認
2. プラグインが有効化されているか確認
3. `/clear` では matcher に該当しないため注入されない（仕様通り）

### HANDOVER.md が意図せず消える

`claude -p` が内部的に SessionStart hook をトリガーし、HANDOVER.md を読み取り→削除する。
現在の実装では一時ファイル経由 + `mv` リネームで回避済み。

## 依存関係

| ツール | バージョン確認 | インストール |
|-------|--------------|-------------|
| claude CLI | `claude --version` | `npm install -g @anthropic-ai/claude-code` |
| jq | `jq --version` | `brew install jq` |

## パフォーマンス実績

| 処理 | 時間 | コスト | 備考 |
|------|------|--------|------|
| PreCompact hook（全体） | 30〜60秒 | ~$0.16 | jq フィルタ + claude -p sonnet |
| jq フィルタ | <1秒 | - | 700KB → 139KB |
| claude -p sonnet | 30〜60秒 | ~$0.16 | ~35k tokens 入力 → ~2.5KB 出力 |
| SessionStart hook | <1秒 | - | ファイル読み取り + 削除 |
| HANDOVER.md サイズ | - | - | 典型的に 2〜3KB |

## テンプレートを変更したい場合

`skills/handover/SKILL.md` の「## HANDOVER.md テンプレート」以降を変更する。
PreCompact hook は SKILL.md から動的に読み込むため、個別の変更は不要。

ただしプラグインのファイルはキャッシュ内にあるため、直接編集は非推奨。
フォークして独自のプラグインとして使用することを推奨。
