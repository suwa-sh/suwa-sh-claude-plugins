---
name: toolbox:mid-harness
description: コーディングエージェントをまたいで持ち運べる資産 (中ハーネス = AGENTS.md / skills / agent-specs / hooks / memory) を portable core + 薄い製品別 adapter の構成で、新規リポへ展開 (init)、既存リポへ適用 (apply)、ドリフトと振る舞い同等性を検査 (audit) する。「中ハーネスを展開して」「この構成を既存リポに適用して」「Claude Code と Codex で同じ動きをさせたい」「adapter がドリフトしていないか見て」と言われたら発動。
---

# mid-harness

## このスキルが解く問題

Claude Code / Codex CLI などのコーディングエージェントは、指示ファイル・skill・custom agent・hook の**置き場と schema が製品ごとに違う**。同じ振る舞いを複数製品で保つには、資産を製品非依存の **portable core** に置き、各製品が読む設定は **core から生成する薄い adapter** にする。

このスキルは、その構成を機械的に作り、既存資産を分類して移送し、生成物のドリフトと振る舞いの同等性を検査する。設計原則は `references/contracts.md`、推奨構成は `references/layout.md`、製品ごとの読込規則は `references/adapters/<product>.md` を正本とする。

用語: この資産層を **中ハーネス** と呼ぶ (内=製品ランタイム、中=ユーザーが書き持ち運べる資産、外=起動基盤)。

## 入力

`$ARGUMENTS` = `<mode> [<repo-path>] [--targets a,b] [--skills-mode generate|symlink|manual]`

| mode | 用途 | 書き込み |
|---|---|---|
| `init` | 新規リポ (または中ハーネス未導入のリポ) に推奨構成を展開する | あり (既存ファイルは上書きしない) |
| `apply` | 既存リポの資産を 6 契約へ分類し、人の承認後に core へ移送して adapter を生成する | あり (承認後のみ) |
| `audit` | 生成物ドリフトと受け入れテストを検査する。CI 向け | なし |

`<repo-path>` 省略時はカレントの git リポ root。`--targets` 省略時は `claude-code,codex`。対応製品は `claude-code` / `codex` / `cursor` / `grok` / `copilot` / `antigravity` (製品ごとの読込規則と実測結果は `references/adapters/README.md` の早見表)。

## 前提

- python3 3.11+ と PyYAML (`python3 -c 'import yaml, tomllib'`)。3.10 以下では `pip install tomli` も必要 (生成した TOML を必ず検証する。検証器が無ければ生成は失敗する)。無ければインストールを案内して停止する
- 対象製品の CLI (`claude` / `codex` / `agent` / `grok` / `copilot` / `agy`) は verify にだけ必要。無い製品は verify を skip と報告する
- hook の受け入れテストには製品ごとの trust 前提がある: Codex は hook trust (verify が bypass)、Grok は folder trust (`~/.grok/trusted_folders.toml`)、Antigravity は workspace の project 登録 + trust (`agy --new-project` を一度)。Copilot は `-p` で repo hook が既定で無効なため、repo 単位なら `~/.copilot/settings.json` の `trustedFolders`、invocation 単位なら `GITHUB_COPILOT_PROMPT_MODE_REPO_HOOKS=true` で有効化する (verify は後者を付与。`references/adapters/copilot.md`)
- `references/adapters/<product>.md` の先頭にある **確認日と確認バージョン** を見て、対象製品のバージョンが大きく進んでいたら公式 doc で読込規則を再確認してから進める (推測で adapter を変えない)

## 手順

`<skill-base-dir>` はこのスキルのロード時に表示される "Base directory for this skill"。scripts はすべて `python3 <skill-base-dir>/scripts/<name>.py --help` で引数を確認できる。

### 共通: 開始時

1. `references/contracts.md` と `references/layout.md` を読む
2. 対象リポの root を確定する (`git rev-parse --show-toplevel`)
3. `python3 <skill-base-dir>/scripts/inventory.py <repo> --out <tmp>/inventory.json` で現状を棚卸しする (init でも実行し、既導入なら apply へ切り替える)

### init

1. `python3 <skill-base-dir>/scripts/scaffold.py <repo> --targets <targets> --skills-mode <mode>` を実行する
   - `references/layout.md` の推奨ツリーを `templates/` から展開する。既存ファイルは触らず、skip 一覧を出す
   - `.agents/harness.yaml` (manifest) を生成する
2. `python3 <skill-base-dir>/scripts/gen_adapters.py <repo>` で製品別 adapter を生成する。変換不能な項目や、所有マーカーの無い既存 agent 定義があれば**何も書かずに**非ゼロ終了するので、manifest か policy を直して再実行する (既存の手書き agent 定義を取り込む場合だけ `--adopt`)
3. `bash <skill-base-dir>/scripts/verify.sh <repo>` で受け入れテスト (skill 発見 / headless / hook 拒否) を回す
4. 結果を報告する (下記「報告」)

### apply

1. inventory.json を読み、各資産を `references/contracts.md` の **6 契約** (Rules / Skills / Agents / Hooks / MCP / Memory-Knowledge) と **配置先** (core のどこか、adapter として残すか、対象外か) に分類する。分類は LLM の判断で行い、`inventory.json` の各要素に `contract` と `target` を書き足した `placement.json` を作る
   - 判断基準は contracts.md の「各ファイルに何を書くか」表。迷ったら「人にも必要か → docs、複数 skill か → memory、1 skill か → references」
   - 製品固有 field (Claude の `allowed-tools` / `model` / `hooks` など) は core に持ち込まず adapter 側へ残す
2. 配置案を **human-html-review** (`toolbox:human-html-review`、approval モード) で提示し、承認を待つ。**承認前にファイルを動かさない**
3. 承認後、移送する
   - `git mv` で core へ移す (履歴を保つ)。既存 symlink (例: `.agents/skills -> ../.claude/skills`) は方向を逆転させる: 実体を `.agents/` 側へ移し、製品側は生成物にする
   - `.agents/harness.yaml` に targets / hooks / agents を追記する
   - 旧パスを読む仕組みが残る場合だけ、薄い shim を置く
4. `gen_adapters.py --adopt` (移送した手書き agent 定義を取り込む) → `verify.sh` を init と同じ順で回す
5. 報告する。verify 不合格なら exit 2 (未完了) として、移送済みの差分は残したまま何が足りないかを列挙する

### audit

1. `python3 <skill-base-dir>/scripts/check_drift.py <repo>` で「manifest から再生成した adapter」と「commit 済み adapter」の差分を出す。差分があれば exit 1
2. `bash <skill-base-dir>/scripts/verify.sh <repo>` を回す。不合格なら exit 2
3. リポの資産には書き込まない。verify は一意名のプローブ skill を一時作成して終了時に削除する (LLM 呼び出しを避けるなら `MID_HARNESS_VERIFY_SKIP_LLM=1`)。報告のみ

### 生成物の増減で気を付けること (全モード共通)

- manifest から agent を外す / core から skill を消す / targets から製品を外すと、その所有マーカー付き生成物 (agent 定義、生成 skill ディレクトリ、Codex 管理ブロック) は次回の `gen_adapters.py` で削除される。手書き (マーカー無し) は残る
- targets から製品を外したときの hook 設定は製品で違う: Grok / Copilot の所有ファイル (`.grok/hooks/mid-harness.json` / `.github/hooks/mid-harness.json`) と Antigravity の所有キー (`.agents/hooks.json#mid-harness`) は削除されるが、Claude Code / Codex / Cursor の**既存設定ファイルに埋め込んだ handler は残る** (その製品の設定ファイルを開かないため)。この 3 製品を外すときは、先に `hooks: []` で一度生成してから targets を外す
- 生成先 (`.claude/settings.json` 等) やその親が symlink だと生成は失敗する (リポ外への書き込み防止)

## 完了条件

- init / apply: `gen_adapters.py` が exit 0、`check_drift.py` が exit 0、`verify.sh` が対象製品すべてで pass または skip (CLI 不在)
- audit: 上記 2 スクリプトの結果を報告した

## 停止条件

- PyYAML 不在、対象パスが git リポでない → 停止して案内
- apply で承認が得られない → 配置案 (placement.json と review HTML) だけ残して停止
- `gen_adapters.py` が変換不能で失敗 → manifest / policy を直す提案を出して停止 (推測で adapter 仕様を書き換えない)

## 報告

次の 3 点を必ず含める:

1. 何を判断してほしいか (apply なら配置案の承認、verify 不合格なら対処方針)
2. 根拠 (inventory 件数、生成した adapter の一覧、verify の pass / fail / skip と各コマンド)
3. 次に起きること (drift 検査を CI に入れる、残りの製品を targets に足す、など)

## このスキルの学び

製品側の挙動差や scripts のハマりどころは `references/recovery.md` に追記する (メモリでなくここに書く。別セッションの実行者に届くのはファイルだけ)。

## 参照

| ファイル | 読むタイミング |
|---|---|
| `references/contracts.md` | 常時。6 契約と「各ファイルに何を書くか」 |
| `references/layout.md` | init / apply の前。推奨ツリーと manifest |
| `references/adapters/claude-code.md` / `codex.md` | gen_adapters の変換規則を疑うとき、製品バージョンが進んだとき |
| `references/knowledge.md` | docs と `.agents/memory` の置き分け、昇格ルール、OKF front matter |
| `references/acceptance-tests.md` | verify.sh の 3 項目と、手動で行う残り 5 項目 |
| `references/recovery.md` | 失敗したとき |
