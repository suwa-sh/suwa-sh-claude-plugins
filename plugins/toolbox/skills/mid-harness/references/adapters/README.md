# adapters

製品ごとの読込規則と変換規則。`scripts/gen_adapters.py` の変換表と対で保守する (doc を直したらスクリプトの `EVENT_MAP` / `CAPABILITY_MAP` も直す)。

| 製品 | target 名 | ファイル | 状態 (2026-09-05) |
|---|---|---|---|
| Claude Code | `claude-code` | `claude-code.md` | 確認済み。hook / skill 発見を実測 |
| Codex CLI | `codex` | `codex.md` | 確認済み。hook trust hash / cwd / tool_name を実測 |
| Cursor Agent CLI | `cursor` | `cursor.md` | 確認済み。hook stdin (tool_name 無し) を実測 |
| Grok Build | `grok` | `grok.md` | 確認済み。hook stdin / folder trust / hook ファイル基準の相対パスを実測 |
| GitHub Copilot CLI | `copilot` | `copilot.md` | 一部未検証。user hook の stdin は実測。**repo hook (`.github/hooks/`) は `-p` で発火しなかった** |
| Antigravity CLI | `antigravity` | `antigravity.md` | 確認済み。workspace の project 登録 + trust が前提。hook stdin (toolCall) / cwd (`.agents/`) を実測 |

### 製品差の早見表

| | hook 設定 | hook stdin の command | ブロック | hook の cwd | skills 正本 `.agents/skills` | agent 定義 |
|---|---|---|---|---|---|---|
| Claude Code | `.claude/settings.json` hooks | `tool_input.command` | exit 2 + stderr | `$CLAUDE_PROJECT_DIR` あり | 読まない (生成 / symlink) | `.claude/agents/<n>.md` |
| Codex | `.codex/hooks.json` | `tool_input.command` | exit 2 + stderr | セッション cwd | 読む | `.codex/agents/<n>.toml` + config.toml |
| Cursor | `.cursor/hooks.json` (`beforeShellExecution`) | top-level `command` | exit 2 / `{"permission":"deny"}` | project root | 読む | `.cursor/agents/<n>.md` |
| Grok | `.grok/hooks/*.json` (Claude 形式) | `toolInput.command` | exit 2 / `{"decision":"deny"}` | hook ファイルのディレクトリ | 読む | `.grok/agents/<n>.md` |
| Copilot | `.github/hooks/*.json` (`preToolUse`) | `toolArgs.command` (文字列のことも) | `{"permissionDecision":"deny"}` / exit 2 | project cwd | 読む (未実測) | `.github/agents/<n>.md` |
| Antigravity | `.agents/hooks.json` (hook 名 → イベント) | `toolCall.args.CommandLine` | `{"decision":"deny"}` | `.agents/` | 読む | `.agents/agents/<n>/agent.md` |

hook スクリプト (`templates/tree/scripts/agent-hooks/pre-tool-policy.sh`) はこの 6 形式を 1 本で正規化し、ブロック時は全形式の JSON を stdout に出しつつ exit 2 する。
