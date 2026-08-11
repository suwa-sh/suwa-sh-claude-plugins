---
name: cc:launch-claude
description: >-
  ghq 管理リポジトリを対象に、Ghostty のスプリットで新しい Claude Code セッションを起動し、
  起動済みセッションの操作も行うスキル。「launch claude」「start claude in」「open claude code in」
  「claude を起動して」「〜で claude code を開いて」など、別セッションで特定リポジトリの作業を
  始めたいときに必ず使う。開きたいリポジトリ名だけの指示（例:「RDRAAgentで」「pkmを開いて」
  「sandboxで作業したい」「別セッションで開いて」）や、リポジトリのキーワードだけ言って
  新セッション起動を期待している場合でも発動する。起動時に自動実行するスラッシュコマンドの指定
  （例:「/cc:launch-claude pkm /deep-research テーマ」）、モデルやエージェントペルソナの選択
  （例:「pkm を fable の marketer で開いて」）に対応。起動済みペインへの操作 —
  実行中セッションの一覧、ペインへのコマンド送信、外からの Remote Control 有効化
  （例:「さっき開いたセッションを remote on にして」「あのペインに /clear を送って」
  「起動済みセッション一覧」） — もこのスキルで扱う。
---

# リポジトリで Claude Code を起動する

ghq 管理リポジトリを対象に、Claude Code（`--dangerously-skip-permissions`）を実行する新しい Ghostty スプリットを開く。起動時に自動実行するスラッシュコマンド、モデル、エージェントペルソナを任意で指定できる。

このスキルの仕事は 2 つ:

| ユーザーの要望 | 参照先 |
|---|---|
| リポジトリで**新しい**セッションを開く | Step 0–4（起動） |
| **起動済み**ペインを操作する（一覧 / コマンド送信 / Remote Control） | Step 5（操作） |

## ワークフロー

### 0. 依存関係の確認

まず同梱のチェックスクリプトを実行する。`scripts/` はこの `SKILL.md` の隣にあるため、
Claude Code プラグインとしてインストールされた場合（`~/.claude/plugins/...`）でも
`npx skills` 経由の場合（`~/.claude/skills/` や `./.claude/skills/`）でも同じ探索で見つかる:

```bash
CHECK="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/check_deps.sh' 2>/dev/null | head -1)"
if [ -z "$CHECK" ] || [ ! -f "$CHECK" ]; then
  echo "ERROR: check_deps.sh not found. Reinstall the cc plugin or the cc:launch-claude skill." >&2
  exit 1
fi
bash "$CHECK"
```

FAIL が報告されたら停止し、何が不足しているかをユーザーに伝える。WARN のみ（例: Ghostty が未起動）ならユーザーに知らせ、確認が取れたら続行する。

### 1. 引数の解析

`$ARGUMENTS` に含まれ得るもの: `<repo-keyword> [--model <alias>] [--agent <name>] [/slash-command args...]`

- 任意の `--model <alias>` と `--agent <name>` フラグを抽出する（順不同で、スラッシュコマンドより前に現れる）
  - `--model` は claude のモデルエイリアス（`fable`, `opus`, `sonnet`）またはフルモデル名を受け取り、そのまま `claude --model` に渡す
  - `--agent` はエージェント/ペルソナ名（例: `marketer`, `journaler`, `maintainer`）を受け取り、そのまま `claude --agent` に渡す
- リポジトリキーワードを抽出する（最初の `/` より前かつフラグ以外の残りの語）
- 任意のスラッシュコマンドを抽出する（最初の `/` 以降すべて）

自然言語の依頼はこれらのフラグに対応づけてから起動する:

- 「fable の marketer で」 → `--model fable --agent marketer`
- 「marketer ペルソナで」 → `--agent marketer`
- 「opus で開いて」 → `--model opus`

例:

- `pkm /deep-research ハーネスエンジニアリング` → キーワード: `pkm`、スラッシュコマンド: `/deep-research ハーネスエンジニアリング`
- `pkm` → キーワード: `pkm`、スラッシュコマンドなし
- `pkm --model fable --agent marketer` → キーワード: `pkm`、モデル: `fable`、エージェント: `marketer`、スラッシュコマンドなし
- `pkm --agent journaler /journal-review` → キーワード: `pkm`、エージェント: `journaler`、スラッシュコマンド: `/journal-review`
- `rdra agent /tech-dr テーマ` → キーワード: `rdra agent`、スラッシュコマンド: `/tech-dr テーマ`

### 2. リポジトリの検索

Step 1 で抽出したキーワードで `ghq list -p | grep -i <keyword>` を実行する。

ユーザーがキーワードではなく絶対パス（`/` または `~` 始まり）を指定した場合は、ghq 検索をせずそのパスを直接使う。ディレクトリが存在しなければ `mkdir -p` で作成する。

### 3. 検索結果の扱い

- **0 件**: リポジトリが見つからなかったことを伝え、キーワードの見直しか `ghq list` での確認を提案する。
- **1 件**: 確認なしで即座に起動へ進む。
- **複数件**: 候補を番号付きで列挙し、ユーザーに選んでもらう。

### 4. 起動

同梱の `scripts/launch_session.sh` を呼ぶ。このスクリプトが `claude` の起動コマンドを組み立てて安全にエスケープし、フロントウィンドウの選択中タブのフォーカス済みターミナルをスプリットする。**AppleScript を手書きしないこと**。scratchpad へのコピーはターン間で消えるうえ、クォート処理を誤りやすい。

```bash
LAUNCH="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/launch_session.sh' 2>/dev/null | head -1)"
bash "$LAUNCH" <target-dir> [--model <alias>] [--agent <name>] [--prompt '<slash-command...>']
```

| オプション | 意味 |
|---|---|
| `--model <alias>` | `claude --model` に渡す |
| `--agent <name>` | `claude --agent` に渡す |
| `--prompt <text>` | 起動時に自動実行するスラッシュコマンド |
| `--name <text>` | 自動生成されるセッション名の上書き |
| `--split right\|left\|down\|up` | ペインの分割方向（デフォルト `right`） |
| `--dry-run` | ペインを開かずシェルコマンドを表示 |

セッション名は自動導出される: `<basename>` + ` [agent/model]` + `: <prompt>` — 例: `pkm`、`pkm [marketer/fable]`、`agent-loop [maintainer]: /journal-review`。`--name` を渡すのは、ユーザーが別の名前を望むときか、同じリポジトリの再起動を区別したいとき（`pkm [fable] 2`）だけ。

例:

```bash
bash "$LAUNCH" /Users/me/src/pkm
bash "$LAUNCH" /Users/me/src/pkm --model fable --agent marketer
bash "$LAUNCH" /Users/me/src/pkm --prompt '/deep-research ハーネスエンジニアリング'
```

起動後、選択したリポジトリで Claude Code が動く新しいスプリットを Ghostty に開いたことをユーザーに伝える（モデル / エージェントを指定した場合はそれも添える）。

### 5. 起動済みセッションの操作

ユーザーが**すでに開いている**セッションに言及したら（「さっき立ち上げたやつ」「あのペイン」「起動済みのセッション」）、`scripts/session_ctl.sh` を使う。`check_deps.sh` と同じ方法で探す:

```bash
CTL="$(find ~/.claude ./.claude -path '*/launch-claude/scripts/session_ctl.sh' 2>/dev/null | head -1)"
```

| コマンド | 動作 |
|---|---|
| `bash "$CTL" list` | すべての Ghostty ペインを `ID \| NAME \| CWD` 形式で表示 |
| `bash "$CTL" resolve <target>` | `<target>` が解決される id を表示（**何も送信しない**） |
| `bash "$CTL" send <target> <text...>` | `<text>` をペインにペーストして Enter を押す |
| `bash "$CTL" remote <target>` | ペインに `/remote-control` を送信 |

`<target>` は `list` のターミナル id、またはペイン名の大文字小文字を区別しない部分文字列（`claude-plugins`、`pkm [fable] 3`）。0 件またはあいまいな一致はエラーになり候補を列挙する — 推測はしない。

ルール:

- **必ず先に `list` を実行**し、どのペインを操作しようとしているかをユーザーに見せる。ペイン名には Step 4 の `[agent/model]` サフィックスが付くため、それが自然な識別子になる。
- **送信は割り込みである。** テキストはそのセッションのプロンプトにペーストされたように届く。ユーザーが指定したペインにだけ送信し、アイドル状態のペインを優先する — 作業中のセッションは割り込みを作業途中で受け取ってしまう。
- `/remote-control` は「オン」スイッチではなく**トグル**である。セッションは通常 Remote Control 有効で起動する（`~/.claude/settings.json` の `remoteControlAtStartup`）ため、正常なセッションに送ると**オフ**になる。claude.ai にセッションが見当たらないとユーザーが言ったときだけ送信し、送信後にペインの状態確認をユーザーに依頼する。
- 稼働中セッションの Remote Control を有効化する CLI は存在しない。`claude --remote-control [name]` は起動時のみ有効。外からの唯一の手段はスラッシュコマンドの注入である。

## 補足

- Ghostty は起動済みで、フロントウィンドウにフォーカス済みターミナルがあること（新しいペインはフォーカス済みペインから分割される）
- 新しいセッションはフロントウィンドウの選択中タブ内のスプリットとして開く
- `ghq list -p` は絶対パスを返すため、grep の結果をそのまま使える
- セッション名は Ghostty のペインタイトルと Claude Code の Remote Control 一覧に表示されるため、スラッシュコマンドや `[agent/model]` サフィックスを含めておくと各セッションの用途を識別しやすい
- `--model` / `--agent` は標準の `claude` CLI オプション（`claude --help`）: `--model` はエイリアス（`fable`, `opus`, `sonnet`）またはフルモデル名、`--agent` は Claude Code が使うのと同じレジストリから解決されるエージェント/ペルソナ名を受け取る
- `-n <name>` は表示名（プロンプトボックス、`/resume` の選択肢、ターミナルタイトル）だけを設定する。Remote Control は別途 `remoteControlAtStartup`、または `--remote-control [name]` 付き起動で制御される
- AppleScript リファレンス: <https://ghostty.org/docs/features/applescript>（`split`, `input text`, `send key`）
