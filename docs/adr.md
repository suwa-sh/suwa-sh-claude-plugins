# ADR (Architecture Decision Records)

## ADR-001: hook type として command を採用

**Status**: Accepted

**Context**: PreCompact hook で HANDOVER.md を自動生成する方式を選択する必要がある。Claude Code の hooks は `command`（シェルスクリプト）と `agent`（サブエージェント）の2タイプを提供する。

**Options**:
1. **command** — シェルスクリプトで外部コマンドを呼び出す
2. **agent** — Claude Code のサブエージェントとして実行する

**Decision**: command タイプを採用。

**Rationale**:
- agent タイプは REPL 外（コンパクション等のシステムイベント）では「Agent stop hooks are not yet supported outside REPL」エラーで動作しない
- command タイプなら `claude -p` パイプモードで要約処理を外部実行できる
- シェルスクリプトとして jq やファイル操作を自由に組み合わせられる

---

## ADR-002: 要約モデルとして Sonnet を採用

**Status**: Accepted

**Context**: `claude -p` パイプモードで引き継ぎドキュメントを生成するモデルを選択する必要がある。

**Options**:
1. **Haiku** — 高速・低コスト・コンテキスト 200k
2. **Sonnet** — 中速・中コスト・コンテキスト 200k
3. **Opus** — 高品質・高コスト

**Decision**: Sonnet を採用。バジェット上限 $2.00。

**Rationale**:
- Haiku では `/handover` スキル（メイン Agent が生成）と比較して品質が劣る
- Sonnet は `/handover` と同等品質の要約を生成できる（実測で確認済み）
- 実測コストは ~$0.16 と十分に低い
- Opus はオーバースペックでコスト対効果が合わない

**Consequences**:
- 生成時間: 30〜60秒（Haiku の数倍だが、120秒のタイムアウト内に収まる）
- コスト: ~$0.16/回（バジェット $2.00 に対して十分な余裕）

---

## ADR-003: jq フィルタで text + tool_use のみ抽出

**Status**: Accepted

**Context**: トランスクリプト全体（~700KB）は `claude -p` のコンテキスト制限を超える。情報量とサイズのバランスを取るフィルタリング戦略が必要。

**Options**:
1. **text のみ** — ~49KB / ~13k tokens。Agent の行動（tool_use）が失われる
2. **text + tool_use** — ~139KB / ~35k tokens。行動内容を含みつつコンパクト
3. **text + tool_use + thinking** — ~284KB / ~71k tokens。内部推論も含む
4. **全体（tool_result 除外のみ）** — ~412KB / ~103k tokens。コンテキスト限界に近い

**Decision**: text + tool_use（~139KB / ~35k tokens）を採用。

**Rationale**:
- text のみでは「何をしたか」しかわからず、`/compact` の要約と差別化できない
- tool_use を含めることで「どのファイルを読み/書きしたか」「どんなコマンドを実行したか」がわかる
- thinking を含めるとサイズが倍増し、要約品質の向上に見合わない
- 35k tokens は Sonnet のコンテキスト（200k）に余裕をもって収まる

---

## ADR-004: 一時ファイル経由でデータを受け渡し

**Status**: Accepted

**Context**: jq の出力（~139KB）を `claude -p` にパイプする方法を決める必要がある。

**Options**:
1. **シェル変数** — `filtered=$(jq ...)` + `echo "$filtered"`
2. **一時ファイル** — `jq ... > tmpfile` + `cat tmpfile`

**Decision**: 一時ファイル（`mktemp` + `trap` で自動削除）を採用。

**Rationale**:
- シェル変数に ~173KB を格納すると `echo "$filtered"` が無言で失敗する（出力なし、エラーなし）
- Bash のシェル変数展開は ~100KB を超えると不安定になる
- 一時ファイルならサイズ制限なし
- `trap 'rm -f "$filtered_file" "$output_file"' EXIT` で確実にクリーンアップ

**Consequences**:
- 一時ファイルの作成・削除のオーバーヘッドは無視できるレベル（<1秒）

---

## ADR-005: mv リネームで SessionStart hook の干渉を回避

**Status**: Accepted

**Context**: `claude -p` の出力を直接 `HANDOVER.md` に書き出すと、ファイルが消失する問題が発生した。

**Root Cause**: `claude -p` は独自のセッションを作成し、SessionStart hook をトリガーする。`session_start.sh` が `HANDOVER.md` を検出して読み取り→削除するため、PreCompact hook が書き込んだ内容が消える。

**Options**:
1. **出力先を HANDOVER.md 以外にして SessionStart hook を改修** — 影響範囲が大きい
2. **`claude -p` に `--no-hooks` 的なオプション** — 存在しない
3. **一時ファイルに出力 → `mv` でリネーム** — `claude -p` 完了後にリネームするため干渉しない

**Decision**: 一時ファイル → `mv` リネームを採用。

**Rationale**:
- `claude -p` 実行中は `HANDOVER.md` が存在しないため、SessionStart hook は何もしない
- `claude -p` 完了後に `mv` するため、タイミングの問題が発生しない
- 既存の hook スクリプトに変更不要

```bash
# 一時ファイルに出力
claude -p ... > "$output_file"
# claude -p 完了後にリネーム
mv "$output_file" "$handover_file"
```

---

## ADR-006: HANDOVER.md を .gitignore に追加

**Status**: Accepted

**Context**: HANDOVER.md はセッション間の引き継ぎ用一時ファイル。バージョン管理の対象にすべきか。

**Options**:
1. **バージョン管理する** — 履歴が残るが、SessionStart hook が削除するため毎回差分が発生
2. **gitignore に追加** — リポジトリには残らないが、引き継ぎには支障なし

**Decision**: プロジェクトの `.gitignore` に `HANDOVER.md` を追加。

**Rationale**:
- HANDOVER.md は SessionStart hook が読み取り後に削除する一時ファイル
- バージョン管理すると、毎セッションで「作成→削除」の差分が発生し、ノイズになる
- 引き継ぎ情報はセッションコンテキストに注入されるため、ファイルとして永続化する必要がない
- プロジェクトをまたいで使う場合、各プロジェクトの `.gitignore` に追加が必要

---

## ADR-007: Plugin 形式で配布

**Status**: Accepted

**Context**: handover ハーネスを GitHub 経由で配布する方式を選択する必要がある。

**Options**:
1. **手動配置** — README でスクリプト配置 + settings.json 手動編集を案内
2. **standalone repo + install script** — install.sh でファイルコピー + settings.json 編集を自動化
3. **Plugin 形式** — `.claude-plugin/plugin.json` + `hooks/hooks.json` で配布

**Decision**: Plugin 形式を採用。

**Rationale**:
- `hooks/hooks.json` で PreCompact / SessionStart フックが自動登録される
- ユーザーが settings.json を手動編集する必要がない
- `/plugin install` で簡単にインストール・アンインストール可能
- `${CLAUDE_PLUGIN_ROOT}` によりプラグインインストール先に依存しないパス解決が可能

**Consequences**:
- プラグインの hooks.json はユーザーから read-only（カスタマイズにはフォークが必要）
- SKILL.md のテンプレート変更もフォークが必要
