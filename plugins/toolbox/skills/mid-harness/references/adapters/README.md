# adapters

製品ごとの読込規則と変換規則。`scripts/gen_adapters.py` の変換表と対で保守する (doc を直したらスクリプトの `EVENT_MAP` / `CAPABILITY_MAP` も直す)。

| 製品 | ファイル | 状態 |
|---|---|---|
| Claude Code | `claude-code.md` | 確認済み 2026-09-05 |
| Codex CLI | `codex.md` | 確認済み 2026-09-05 |
| GitHub Copilot CLI | (未作成) | 記事 (2026-08-07) に読込パスの記載あり。targets に足す前に公式 doc で確認して作成する |
| Antigravity CLI | (未作成) | 同上 |
| Grok Build | (未作成) | 同上 |
| Cursor Agent CLI | (未作成) | 同上 |

未作成の製品を `harness.yaml` の `targets` に書くと `gen_adapters.py` は "unsupported target" で失敗する。
