# Copilot CLI: repo hook (`.github/hooks/*.json`) が `-p` で発火しない問題の整理

- 記録日: 2026-09-05
- 環境: GitHub Copilot CLI 1.0.80 (Homebrew cask は 1.0.65、CLI が自己更新)、macOS 26、`copilot -p` (非対話)
- 状態: **未解決**。mid-harness は docs どおり `.github/hooks/mid-harness.json` を生成するが、受け入れテスト #3 (hook 拒否) は Copilot だけ fail のまま

## 症状

| 置き場 | 形式 | 結果 |
|---|---|---|
| `~/.copilot/hooks/<name>.json` (user) | `{"version":1,"hooks":{"preToolUse":[{"type":"command","bash":"…","timeoutSec":30}]}}` | **発火する**。stdin を取得できた |
| `<repo>/.github/hooks/<name>.json` (repo) | 同じ形式 | **発火しない**。ログにも痕跡なし |

user hook で取得した stdin (実測):

```json
{"sessionId":"…","timestamp":1788584973051,"cwd":"/private/tmp/mh-probe","toolName":"bash","toolArgs":{"command":"echo hello-probe","description":"Echo hello-probe"}}
```

## 公式ドキュメントが言っていること

- hooks reference: repo hooks の置き場は `.github/hooks/*.json`、schema は `{ "version": 1, "hooks": { "preToolUse": [ { "type": "command", "bash": …, "powershell": …, "cwd": …, "timeoutSec": … } ] } }`。`preToolUse` の stdin は `toolName` / `toolArgs` (JSON 文字列のことがある) / `cwd` / `sessionId` / `timestamp`。ブロックは stdout `{"permissionDecision":"deny","permissionDecisionReason":"…"}` または exit 2。`matcher` は `toolName` 全体への正規表現
- tutorial (copilot-cli-hooks): "Copilot agents load hook configurations from `.github/hooks/*.json` files in the repository"。`copilot -p` のセッションで `sessionStart` / `userPromptSubmitted` hook が動く例を掲載
- `copilot help config` (ローカル 1.0.80): `hooks: inline hook definitions, keyed by event name (same schema as .github/hooks/*.json). In global config.json these act as user-level hooks; in repo settings.json they act as repo-level hooks`、`disableAllHooks: whether to disable all hooks (repo-level and user-level); defaults to false`
- `copilot help commands`: `/add-dir … load its .github skills and agents as trusted configuration`

つまり docs 上は repo hook は `-p` でも読まれるはず。

## 試したこと (すべて発火せず)

| # | 試行 | 補足 |
|---|---|---|
| 1 | `.github/hooks/probe.json` に settings.json 形式 `{"hooks":{"toolCall":{"command":…,"shell":"bash"}}}` | _autodocs の旧形式。event 名 `toolCall` / `preToolUse` / `PreToolUse` を並べても同じ |
| 2 | `.github/hooks/probe.json` に hooks reference 形式 (`version: 1`, `preToolUse`, `bash: "bash scripts/agent-hooks/probe.sh"`) | user hook で発火が確認できた形式と同一 |
| 3 | #2 + `bash` を絶対パス、`cwd: "."`、`--add-dir <repo>` | パス解決の問題ではない |
| 4 | tutorial と同形 (`cwd: ".github/hooks"`, `bash: "./scripts/probe.sh"`) | |
| 5 | `.github/copilot.json` と `.github/settings.json` に inline `hooks` | "repo settings.json" の候補 |
| 6 | trust 済み (permissions-config.json に登録済み) の別 repo (pkm) に一時ファイルを置いて実行 | 未 trust が原因ではない |
| 7 | `--allow-all` / `--allow-all-tools` | 権限フラグの違いではない |
| 8 | `--log-level debug --log-dir <dir>` でログ採取 | `[rust:hooks]` の行は `Policy directory /etc/github-copilot/policy.d not readable` と、user hook (Google Cloud telemetry plugin) の `[hook stdout] {}` だけ。repo hook を探索した痕跡が無い |

## 分かっていること / 分かっていないこと

分かっていること:

- hook 実行基盤 (`rust:hooks`) 自体は `-p` で動いており、user hook は発火する
- repo hook の schema を間違えているわけではない (user hook と同一形式で試している)
- repo の trust 有無は関係ない (pkm で再現)

分かっていないこと (仮説):

1. `-p` (非対話) では repo 由来の設定 (`.github/hooks`) を読まない実装になっている (対話セッションで初回に「この repo の設定を信頼するか」を聞く導線がある可能性)
2. repo hook の探索が git remote (github.com の repository) を前提にしている (mh-probe は remote 無し。pkm は remote ありだが同じ結果なので弱い)
3. 1.0.80 の回帰、または feature flag (`/settings experimental` 系) で gated
4. ファイルが git 管理下にある必要がある (mh-probe では正しい形式のファイルを commit していない。pkm でも untracked。**未検証**)

## 次に試すこと (順番)

1. 対話セッションで repo を開き `/env` で hooks が列挙されるか見る。列挙されるなら「`-p` だけ読まない」と確定
2. `.github/hooks/mid-harness.json` を commit してから `-p` を再実行 (仮説 4)
3. hook 探索のログを増やす手段を探す (`copilot help logging` のレベルは `debug` が最大で、`--log-level debug` では repo hook 探索の行が出なかった。`copilot help monitoring` の OTEL 診断ログ、または `COPILOT_HOME` を一時ディレクトリにして user 設定を切り離した状態での再現)
4. `gh` で github/copilot-cli の changelog と issue を「.github/hooks」「-p」「preToolUse not firing」で検索
5. 再現最小構成 (mh-probe 相当) を issue 化する

## mid-harness 側の扱い

- 生成は docs どおり `.github/hooks/mid-harness.json` に行う (`gen_adapters.py copilot()`)。解決したときに生成側の変更は不要な見込み
- `verify.sh` は Copilot の hook テストを fail として報告し、hint にこのファイルを示す
- skill 発見 (`.agents/skills`) と agent 定義 (`.github/agents/<name>.md`、`tools` / `model` / `matcher` は公式仕様どおり) は pass しているので、Copilot 対応で欠けているのは repo hook だけ
