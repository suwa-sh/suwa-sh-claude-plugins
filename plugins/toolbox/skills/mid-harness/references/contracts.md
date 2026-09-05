# 6 つの振る舞い契約と資産の置き分け

出典: [コーディングエージェントをまたいで同じ動きをさせる拡張設計 - 6製品比較](https://zenn.dev/suwash/articles/agentic-coding-clis_20260807) (2026-08-07 時点)。用語「中ハーネス」は [5つのAIエンジニアリングを2軸3階層で整理する](https://zenn.dev/suwash/articles/llm-control-layers-taxonomy_20260818)。

## 目標はファイル互換ではなく振る舞いの同等性

製品ごとに設定ファイル名と schema が違う以上、完全なファイル互換を目指すと最小公倍数に機能を落とす。維持するのはファイルではなく次の契約。移植の成否は「同じファイルを読めたか」ではなく、受け入れテストで「同じ入力に対して許容範囲内の行動になったか」で判定する。

| # | 維持したい振る舞い | 拡張点 | core での置き場 |
|---|---|---|---|
| 1 | どのエージェントでも同じ規約を守る | Instructions / Rules | `AGENTS.md` (+ `CLAUDE.md` は import のみ) |
| 2 | 同じ作業を同じ手順で進める | Skills / Commands | `.agents/skills/<name>/SKILL.md` |
| 3 | 調査やレビューを別の役割へ委譲する | Custom Agents | `.agents/agent-specs/<name>/{prompt.md,policy.yaml}` |
| 4 | 特定イベントで検査や通知を呼び出す | Hooks | `scripts/agent-hooks/*.sh` + manifest の `hooks[]` |
| 5 | 同じ外部システムへ同じ権限で接続する | MCP / Tools | (本スキルの対象外。各製品設定に残す) |
| 6 | Desired state と troubleshooting を適切な範囲で再利用する | Memory / Knowledge | `docs/` (人と共有) / `.agents/memory/` (エージェント専用) / skill の `references/` |

Plugins (拡張一式の配布) は製品依存の manifest なので adapter 側の関心。

## 拡張点の役割

| 拡張点 | 主な用途 | 実行の決まり方 | 注意 |
|---|---|---|---|
| Instructions / Rules | 規約、禁止事項、リポ知識 | セッションや対象ファイルに応じて自動読込 | 読込規則 (連結 / マージ / 上書き) は製品ごとに違う |
| Skills / Commands | 再利用手順 | モデル判断または明示呼び出し | `name` + `description` 以外の front matter は製品依存 |
| Custom Agents | 役割ごとの文脈・ツール分離 | 親エージェントまたはユーザーが委譲 | 共通 schema が無い。中間表現から生成する |
| Hooks | lint、監査、危険操作の拒否、通知 | ライフサイクルイベント | 最も移植しにくい。fail-open / closed は製品依存。強制境界は CI 側にも置く |
| MCP | 外部システム接続 | モデルがツールとして選択 | 認証情報はリポに置かない |
| Memory / Knowledge | desired state、troubleshooting | 人が明示管理するものと製品が自動生成するものがある | auto memory は inbox。正本にしない |

**skill はモデルが選ぶ手順、hook はイベントから自動で呼ばれる処理。** モデル判断に依存させたくない検査は hook に置く。ただし hook が呼ばれることと拒否が成立することは別なので、セキュリティ上重要な検査は CI でも再検証する。

## 各ファイルに何を書くか

| ファイル / ディレクトリ | 書く内容 | 書かない内容 |
|---|---|---|
| `AGENTS.md` | 常時守る behavior contract、標準コマンド、`docs/README.md`・knowledge・skill の読込ルーティング | 長いトラブル履歴、製品固有 schema |
| `CLAUDE.md` | `@AGENTS.md` と Claude Code だけに必要な補足 | `AGENTS.md` と同じ規約の複製 |
| `docs/README.md` | 人とエージェントが共有する architecture、rules、ADR、運用手順、troubleshooting へ漏れなく辿る knowledge map | `.agents/memory/` への逆向きリンク、各文書の本文、常時ロードすべき指示の複製 |
| `.agents/memory/index.md` | OKF bundle の短い索引、いつ何を読むか、昇格ルール | 詳細な手順や全 troubleshooting の本文 |
| `.agents/memory/log.md` | knowledge の追加・更新・廃止履歴 | セッションごとの詳細ログ |
| `.agents/memory/desired-state/*.md` | 複数 skill が共有するエージェント実行上の目標状態、検証方法、例外 | 人も理解すべき architecture や運用規約、一回限りの作業ログ |
| `.agents/memory/troubleshooting/*.md` | 複数 skill にまたがるエージェント固有の症状、原因、検出、復旧、予防 | 人の障害対応にも使う手順、根拠未確認の推測 |
| `docs/troubleshooting/*.md` | 人とエージェントが共有する障害対応、診断、復旧、再発防止 | エージェント実行だけに閉じた tool discovery や context 読込の癖 |
| `.agents/skills/<name>/SKILL.md` | trigger、入力、前提、手順、分岐、完了条件、参照先 | 他 skill にも共通する長い一般知識 |
| `SKILL.md` の front matter | 原則 `name` と `description` | 製品固有の `model`、`context`、`hooks`、安易な `allowed-tools` |
| `references/desired-state.md` | その skill だけの成果物・完了条件・検証コマンド | repository 全体の規約 |
| `references/troubleshooting.md` | その skill 固有の失敗パターンと復旧方法 | 複数 skill で繰り返す問題 |
| `.agents/agent-specs/<name>/prompt.md` | 製品非依存の役割、責任範囲、入力、出力、完了条件、禁止事項 | tool 名、model 名、permission schema |
| `.agents/agent-specs/<name>/policy.yaml` | `read`、`edit`、`shell`、`delegate`、`network` など論理的な能力と、実行前に読む docs | 各製品固有の tool identifier |
| `.claude/agents/`、`.codex/agents/` 等 | agent-specs から生成した製品別 front matter、tool、model、権限設定、docs への直接リンク | portable な役割本文の手修正・重複管理 |
| `scripts/agent-hooks/` | 複数製品から呼ぶ決定的な検査・整形・監査処理 | 製品ごとの event schema |
| `.claude/`、`.codex/` 等 | 読み込み設定、hook event の対応、MCP 接続、権限、plugin manifest など薄い adapter | portable core 本文のコピー |

## apply での分類手順

inventory の各資産について次の順に決める。

1. **どの契約か** (1〜6)。判別できないものは `unknown` として人に聞く
2. **人にも必要か**。必要なら `docs/` が正本 (契約 6 の場合)
3. **複数 skill で使うか**。使うなら `.agents/memory/`、1 skill なら `references/`
4. **製品固有の値を含むか**。含む部分は adapter に残し、本文だけ core へ
5. **移送方法**。`git mv` / 生成物化 / 対象外 (MCP 設定、credential、製品の auto memory)

## 製品別 adapter を薄く保つ

hook の実装本体は `scripts/agent-hooks/` に置き、`.claude/settings.json`、`.codex/hooks.json` には event 名と呼び出し方法だけを書く。製品を替えても検査ロジックは同じで、adapter の schema だけが変わる状態を目指す。

重複が必要な場合、symlink だけに頼ると scanner、sandbox、Windows で差が出る。生成スクリプトで adapter を同期し、CI で差分がないことを検査する (`check_drift.py`)。
