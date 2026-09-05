# 推奨ディレクトリ構成と manifest

## 推奨ツリー

```text
repository/
├── AGENTS.md                      # 常時守る規約 + 読み分けルーティング (正本)
├── CLAUDE.md                      # @AGENTS.md + Claude Code だけの補足
├── docs/
│   ├── README.md                  # 人とエージェントが共有する knowledge の索引
│   ├── architecture/README.md
│   ├── rules/README.md
│   ├── adr/README.md
│   └── troubleshooting/README.md
├── .agents/
│   ├── harness.yaml               # manifest: 生成の入力 (本スキルの追加)
│   ├── memory/                    # エージェント専用 knowledge (OKF bundle)
│   │   ├── index.md               # 短い routing table
│   │   ├── log.md
│   │   ├── desired-state/
│   │   └── troubleshooting/
│   ├── skills/<name>/             # 実行可能 skill の正本
│   │   ├── SKILL.md
│   │   ├── references/
│   │   └── scripts/
│   └── agent-specs/<name>/        # custom agent の製品非依存な中間表現
│       ├── prompt.md
│       └── policy.yaml
├── scripts/agent-hooks/           # hook の検査ロジック本体 (製品非依存)
├── .claude/                       # ← 生成物 (adapter: claude-code)
│   ├── settings.json              #   hooks の所有 handler だけ管理
│   ├── agents/<name>.md
│   └── skills/<name>/             #   generate (コピー) または symlink
├── .codex/                        # ← 生成物 (adapter: codex)
│   ├── config.toml                #   mid-harness 管理ブロックだけ
│   ├── hooks.json
│   └── agents/<name>.toml
├── .cursor/                       # ← 生成物 (adapter: cursor)
│   ├── hooks.json                 #   所有 entry だけ管理
│   └── agents/<name>.md
├── .grok/                         # ← 生成物 (adapter: grok)
│   ├── hooks/mid-harness.json     #   このファイルを丸ごと所有
│   └── agents/<name>.md
├── .github/                       # ← 生成物 (adapter: copilot)
│   ├── hooks/mid-harness.json     #   このファイルを丸ごと所有
│   └── agents/<name>.md
└── .agents/                       # ← 生成物 (adapter: antigravity。core と同居)
    ├── hooks.json                 #   top-level キー "mid-harness" だけ管理
    └── agents/<name>/agent.md
```

`.agents/` の各ディレクトリの責務は `contracts.md` の表を参照。`.agents/memory/` は各製品が自動検出する標準ディレクトリではないので、`AGENTS.md` から `index.md` を明示的に参照させる。

## manifest: `.agents/harness.yaml`

生成 (`gen_adapters.py`) と検査 (`check_drift.py`) の唯一の入力。製品固有の値は書かない (それは `adapters/<product>.md` 側の変換規則)。

```yaml
skill_version: "0.1"           # 生成に使った mid-harness の版
targets: [claude-code, codex]  # claude-code | codex | cursor | grok | copilot | antigravity
skills_mode: generate          # generate | symlink | manual  (Claude Code 向け .claude/skills の作り方。manual = 管理外)
hooks:
  - event: pre-tool            # 論理イベント: pre-tool | post-tool | session-start | stop
    matcher: Bash              # 製品の matcher へそのまま渡す (省略可)
    script: scripts/agent-hooks/pre-tool-policy.sh
    on_unmappable: fail        # fail | skip  (製品がイベントを持たないとき)
agents:
  - reviewer                   # .agents/agent-specs/reviewer/ を指す
```

### 論理イベント → 製品イベント

| 論理 | Claude Code / Codex / Grok | Cursor | Copilot | Antigravity |
|---|---|---|---|---|
| `pre-tool` | `PreToolUse` | `beforeShellExecution` (shell のみ) | `preToolUse` | `PreToolUse` (matcher `*`) |
| `post-tool` | `PostToolUse` | `afterShellExecution` | `postToolUse` | `PostToolUse` |
| `session-start` | `SessionStart` | `sessionStart` | `sessionStart` | (無し → unmappable) |
| `stop` | `Stop` | `stop` | (無し → unmappable) | `Stop` |

`matcher` は Claude Code / Codex / Grok にだけ渡す。Cursor はイベントで絞り、Copilot は絞れず、Antigravity は `*` にする (ツール名が `run_command` で Claude 系と違うため)。

対応表の正本は `adapters/<product>.md`。gen_adapters は adapter ファイルでなく `scripts/gen_adapters.py` 内の表を使うので、adapter doc を更新したらスクリプトの表も同時に更新する (check: `grep EVENT_MAP scripts/gen_adapters.py`)。

## agent-spec: `policy.yaml`

```yaml
description: コードレビューを行い、指摘だけを返す     # 各製品の description に転記
capabilities:
  read: true
  edit: false
  shell: false
  delegate: false
  network: false
model: null                  # 製品非依存の抽象値は持たない。null なら製品既定
docs:                        # 実行前に読む docs への相対パス (repo root 基準)
  - docs/architecture/README.md
  - docs/rules/README.md
on_unmappable: fail          # fail | skip
```

`prompt.md` は役割・責任範囲・入力・出力・完了条件・禁止事項だけを書き、tool 名や model 名を含めない。

## 生成物の扱い

- 生成された adapter は **commit する** (製品はリポ内のファイルを読むため)。ただし手修正しない。修正は core か manifest に対して行い、再生成する
- `check_drift.py` を CI に入れ、再生成結果と commit 済みの差分をゼロに保つ
- adapter ファイルのうち mid-harness が管理するのは「生成マーカー付きの部分」だけ。`.claude/settings.json` の `permissions` や `.codex/config.toml` の他設定は触らない
- manifest から agent を外すと、所有マーカー付きの生成物 (`.claude/agents/<name>.md` / `.codex/agents/<name>.toml` / config.toml の管理ブロック内の行) は次回生成で削除される。targets から製品を外した場合も、その製品の所有マーカー付き agent 定義は削除される。手書き (マーカー無し) は残る
- targets から製品を外したときの hook 設定: Grok / Copilot の所有ファイルと Antigravity の所有キーは削除される。**Claude Code / Codex / Cursor の既存設定ファイルに埋め込んだ所有 handler は触らない** (その製品の設定ファイルを開かないため)。この 3 製品を外すときは手で消すか、一度 targets に残したまま `hooks: []` で生成してから外す。`check_drift.py` は残った所有ファイル / キーを孤児として検出する
- `.agents/skills/<name>/` の中に symlink があると generate は失敗する (コピーで実体化されリポ外を取り込むため)
