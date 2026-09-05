# sample: mid-harness `init` の出力 (6 製品 targets)

`toolbox:mid-harness` の `init` を空の git リポに対して実行した結果をそのまま置いたものです。何が生成され、各製品が何を読むかを見るためのサンプルで、正本は `plugins/toolbox/skills/mid-harness/` (templates + scripts) です。

- 生成日: 2026-09-05 / toolbox 0.7.0
- targets: `claude-code, codex, cursor, grok, copilot, antigravity`
- `bash regenerate.sh --check` で現在の templates / scripts との drift を検査できる (`bash regenerate.sh` で作り直し)

## 実行したコマンド

```bash
git init <repo>
S=plugins/toolbox/skills/mid-harness/scripts
python3 $S/scaffold.py     <repo> --targets claude-code,codex,cursor,grok,copilot,antigravity   # logs/01-scaffold.log
python3 $S/gen_adapters.py <repo>                                                                # logs/02-gen_adapters.log
python3 $S/check_drift.py  <repo>                                                                # logs/03-check_drift.log
bash    $S/verify.sh       <repo>                                                                # logs/04-verify-run1.log
```

## 出力の読み方

`init-output/` が生成物です。上が人が書く **portable core**、下が core から生成された **製品別 adapter** (手修正しない)。

```text
init-output/
├── AGENTS.md / CLAUDE.md               # 規約の正本と Claude 用の @import 入口
├── docs/                               # 人とエージェントが共有する knowledge の索引
├── .agents/
│   ├── harness.yaml                    # manifest: adapter 生成の唯一の入力
│   ├── memory/                         # エージェント専用 knowledge (OKF)
│   ├── skills/                         # skill の正本 (この sample は README のみ)
│   ├── agent-specs/reviewer/           # custom agent の製品非依存な中間表現 (prompt.md + policy.yaml)
│   ├── hooks.json                      # ← adapter (antigravity): top-level "mid-harness" キーだけ管理
│   └── agents/reviewer/agent.md        # ← adapter (antigravity)
├── scripts/agent-hooks/pre-tool-policy.sh   # hook の本体。6 製品の stdin/stdout 形式を 1 本で吸収
├── .claude/settings.json, agents/      # ← adapter (claude-code)
├── .codex/hooks.json, config.toml, agents/  # ← adapter (codex)
├── .cursor/hooks.json, agents/         # ← adapter (cursor)
├── .grok/hooks/mid-harness.json, agents/    # ← adapter (grok)
└── .github/hooks/mid-harness.json, agents/  # ← adapter (copilot)
```

同じ `reviewer` agent-spec と同じ `pre-tool` hook が、製品ごとにどう変換されるかを見比べると差が分かります (例: hook の command が `$CLAUDE_PROJECT_DIR` / `$(git rev-parse --show-toplevel)` / 相対パスと製品ごとに違う。理由は各製品で hook の cwd が違うため)。

## 受け入れテストの結果 (同じ手順で作った別リポで実行)

| 製品 | CLI | skill 発見 | headless で hook が拒否 | 備考 |
|---|---|---|---|---|
| Claude Code | 2.1.261 | pass | pass | |
| Codex CLI | 0.145.0 | pass | pass | hook trust を `--dangerously-bypass-hook-trust` でバイパスして配線を検証 |
| Cursor | 2026.09.02 | pass | pass | `--model auto` (Opus の usage limit 回避) |
| Grok Build | 1.0.13 | pass | pass | `~/.grok/trusted_folders.toml` に canonical パスで trust が必要 |
| GitHub Copilot CLI | 1.0.83 | pass | pass | `-p` は repo hook が既定無効。`trustedFolders` (repo 単位) または `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true` (invocation 単位) で有効化。両経路で実測 (2026-09-05) |
| Antigravity CLI | 1.1.26 | pass | pass | 初回に `agy -p "…" --new-project` で project 登録 + trust。以降 verify は folderUri から引いた project ID を `--project` に渡す |

`logs/04-verify-run1.log` は 1 回目 (grok と antigravity が trust のパス問題で fail) の記録。canonical パスで trust し直した再実行で上表の結果になった。Copilot はその後、1.0.83 の一時リポで環境変数による opt-in を加えて再検証し、skill 発見・hook 拒否とも pass を確認した。詳細は `plugins/toolbox/skills/mid-harness/references/adapters/README.md` の早見表と各製品の doc。

## 製品ごとの前提 (verify を通すのに必要だったこと)

- Codex: project trust (`~/.codex/config.toml` の `[projects."<path>"]`) に加え hook 単位の trust hash がある
- Grok: `~/.grok/trusted_folders.toml` に `[folders."<canonical path>"] trusted = true`
- Antigravity: `~/.gemini/antigravity-cli/settings.json` の `trustedWorkspaces` に canonical パス + project 登録
- Cursor: `agent -p --trust --force`
- Copilot: `-p` は repo hook が既定で無効。invocation 単位なら `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true copilot -p "…" --allow-all-tools` (verify はこちら)。repo 単位の `trustedFolders` は手編集だと CLI に書き戻されて消えるので、対話 `copilot` の trust プロンプト経由で入れる
