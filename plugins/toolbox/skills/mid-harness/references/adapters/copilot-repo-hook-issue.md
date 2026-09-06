# Copilot CLI: repo hook (`.github/hooks/*.json`) が `-p` で発火しない問題の整理

- 記録日: 2026-09-05
- 環境: GitHub Copilot CLI 1.0.80 (Homebrew cask は 1.0.65、CLI が自己更新)、macOS 26、`copilot -p` (非対話)
- 状態: **解決済み** (2026-09-05、CLI 1.0.83 で再検証)。`-p` は repo hook が既定で無効。repo 単位なら `trustedFolders`、invocation 単位なら環境変数で有効化する (下記「有効化の 3 経路」)。


## 有効化の 3 経路 (2026-09-05 追記、1.0.83 の app.js を読んで実測)

prompt mode で repo hook を読む条件は CLI 内部で次の OR になっている (`app.js`: `COPILOT_ALLOW_ALL==="true" || GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS==="true" || isFolderTrusted(cwd)`)。

| 経路 | 粒度 | 使いどころ |
|---|---|---|
| `~/.copilot/settings.json` の `trustedFolders` に repo の絶対パスを追加 (`copilot help config`: "list of folders where permission to read or execute files has been granted") | **repo 単位・ユーザー側の設定** | 手元で常用する repo。対話セッションで trust すると記録される想定の場所。実測: 変数なしで `Loading repo hooks in prompt mode (folder is trusted or opt-in set)` → hook 発火・拒否 |
| `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true` | invocation 単位 | CI、単発の検証 (verify.sh はこれ) |
| `COPILOT_ALLOW_ALL=true` | invocation 単位 (tools / paths / urls も全許可) | 使わない (hook 以外も全開放) |

**永続化の正本は `~/.copilot/config.json`** (2026-09-06 実測): 対話 `copilot` の trust ダイアログで remember を選ぶと、`settings.json` ではなく CLI 管理の `config.json` (先頭に `// This file is managed automatically.` の JSONC) の `trustedFolders` に書かれる。内部の判定 `folderTrustIsTrusted(cwd, configDir)` がこれを読み、以後 `-p` でも変数なしで `Loading repo hooks in prompt mode` → `hookCount=3` になった。`trust_status.py` は 0.8.5 から config.json / settings.json の両方を見る (0.8.4 までは settings.json だけを見て missing と誤報告していた)。

**`settings.json` の `trustedFolders` を手で書いても永続しない** (2026-09-06 実測 ×2): `~/.copilot/settings.json` は CLI が終了時に自分の状態で書き戻すため、手編集で足した `trustedFolders` は次の `copilot` 実行後に消えていた (書いた直後の 1 回だけは効く)。永続させるには CLI 自身に書かせる: 対話セッションの trust ダイアログ "Do you trust the files in this folder?" で **remember** を選ぶ (`addTrustedFolder` → `trustedFolders` に書く。"yes" はそのセッション限り)。それができない環境では invocation ごとに環境変数を付ける。

**ダイアログが出ないケース** (2026-09-06 実測): 対話 UI の trust 判定は `trustedFolders` に加えて **`~/.copilot/ide/*.lock` (VS Code の Copilot 拡張が書く、`workspaceFolders` + `isTrusted`)** も見る (`app.js` の `aG()`: IDE lock file を走査)。VS Code でその repo を trust 済みで開いていると、CLI はダイアログを出さず `trustedFolders` にも書かない。一方 `-p` の `isFolderTrusted` は IDE lock を見ないので repo hook は読まれない。ダイアログを出すには、その repo を開いている VS Code ウィンドウを閉じて (lock が消える) から `copilot` を起動し、remember を選ぶ。

repo 内のファイル (`.env` 等) で有効化する経路は無い。Copilot CLI は repo の `.env` を読まず (`copilot help environment` / `help config` に該当なし、app.js に dotenv 読込なし)、これは「未知の repo の hook が黙って動く」のを防ぐ設計意図に沿っている。repo 単位で安全に効かせたいなら `trustedFolders` (ユーザー側) を使う。shell 側で `.envrc` (direnv、`direnv allow` の trust ゲートあり) に export する手もあるが、agent-loop のような非対話シェルでは direnv hook が入っていないと効かない。

## 解消方法と検証結果 (Codex による初回解消: 環境変数)

対象 repo の hook 内容を確認したうえで、起動時に次の環境変数を指定する:

```sh
GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true copilot -p "<prompt>" --allow-all-tools
```

[GitHub の Awesome Copilot: Automating with Hooks](https://awesome-copilot.github.com/learning-hub/automating-with-hooks/#auto-approve-permissions-in-ci-with-permissionrequest) に、prompt mode では repo hook が既定で無効であり、この変数で opt-in する旨が明記されている。同じ症状の [github/copilot-cli #3345](https://github.com/github/copilot-cli/issues/3345) も存在する。

macOS、CLI 1.0.83、remote なし・commit なしの一時 git repo で、`scaffold.py --targets copilot` → `gen_adapters.py` が生成した hook を変更せず比較した。実行プロンプトは `Run exactly this shell command and report what happened: echo MID_HARNESS_DENY_ME`。`MID_HARNESS_HOOK_LOG` は比較ごとに別パスを指定した。

| 起動条件 | hook ログ | CLI の結果 |
|---|---|---|
| 環境変数を unset | ログなし | echo が実行され番兵文字列を出力 |
| 環境変数を `true` に設定 | `invoked shell` / `deny test-sentinel` | `Denied by preToolUse hook: test sentinel`、コマンド実行を拒否 |

これにより、少なくとも 1.0.83 では hook の git add / commit、remote、user hook への移設は不要と確認できた。1.0.80 に戻しての比較はしていない。

`verify.sh` は Copilot の invocation に限ってこの変数を付与する。adapter の生成形式・生成先の変更は不要。手動実行や CI でも repo hook を必要とする起動には同じ指定が必要。

修正後の `bash scripts/verify.sh <一時repo>` は `skill-discovery` / `headless+hook-deny` とも pass。`check_drift.py` は `no drift`。既存の `test_hook.sh` と `test_scripts.sh` も全件 pass。

## 初回調査の記録 (解消前)

以下は 1.0.80 での調査履歴。未検証の仮説や「次に試すこと」は当時の記録であり、現在の復旧手順は上記。

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

## mid-harness 側の扱い (解消前の記録)

- 生成は docs どおり `.github/hooks/mid-harness.json` に行う (`gen_adapters.py copilot()`)。解決したときに生成側の変更は不要な見込み
- `verify.sh` は Copilot の hook テストを fail として報告し、hint にこのファイルを示す
- skill 発見 (`.agents/skills`) と agent 定義 (`.github/agents/<name>.md`、`tools` / `model` / `matcher` は公式仕様どおり) は pass しているので、Copilot 対応で欠けているのは repo hook だけ
