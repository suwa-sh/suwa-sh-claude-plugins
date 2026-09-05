# Knowledge の置き分けと昇格

## 二つの読込経路

- `docs/README.md` … 人とエージェントが共有する knowledge を**漏れなく**辿れる索引。各カテゴリの README を中継してよい。リンク切れ・孤立文書を CI で検査する
- `.agents/memory/index.md` … エージェント専用 knowledge の入口と、共有 docs への一方向ルーター。人向け索引には含めない
- custom agent の定義には、その役割が通常必要とする docs への直接リンクを持たせる (実行時の最短経路)。本文は複製しない。`policy.yaml` の `docs:` に書き、adapter 生成時に相対パスを製品の配置階層に合わせて書き換える

Markdown リンクを書くだけで各 CLI が内容をロードするとは限らない。「作業前に読む」「この条件のときに読む」と命令まで明示する。Claude Code の `@path` import は起動時に展開するので、長い docs をすべて import すると段階的開示にならない。

## 置き分け

| 内容 | 人にも必要 | 一つの skill だけで使う | 複数 skill で使う |
|---|---|---|---|
| Desired state | `docs/architecture/`、`docs/rules/`、ADR | `.agents/skills/<name>/references/desired-state.md` | `.agents/memory/desired-state/*.md` |
| Troubleshooting | `docs/troubleshooting/*.md` | `.agents/skills/<name>/references/troubleshooting.md` | `.agents/memory/troubleshooting/*.md` |

各製品の auto memory (Claude Code の `~/.claude/projects/<p>/memory/`、Codex の `~/.codex/memories/` など) は**候補知識の inbox**。再現確認してから明示ファイルへ昇格する。正本にしない。

## 昇格ルール

1. skill 実行中に得た desired state や troubleshooting を、その skill の `references/` へ記録する
2. 別の skill でも同じ知識が必要になったら `.agents/memory/` へ昇格する
3. `index.md` へ「いつ読むか」を一行追加する
4. 元の skill から共通ファイルを参照し、重複本文を削除する
5. 最終確認日や対象バージョンが古くなった項目を定期的に再検証する

## OKF front matter (`.agents/memory/`)

`index.md` は `okf_version` だけを宣言する。concept document は `type` だけを必須にし、`generated` / `verified` / `sources` / `stale_after` は通常付けない (先回りの期限設定はメンテ対象を増やす)。古くなった knowledge は更新か削除。履歴として残す価値がある場合だけ、その時点で `status` や `stale_after` を足す。

`SKILL.md` は Agent Skills 仕様の front matter を優先し、OKF fields を混在させない。

### index.md

```md
---
okf_version: "0.2"
---

# リポジトリのメモリー

## 基本の期待状態
- リポジトリ全体を変更するとき: [リポジトリの期待状態](../../docs/architecture/README.md)
- 作業を完了する前: [品質ゲート](../../docs/rules/README.md)

## 必要なときに読む
- CI が失敗したとき: [CI のトラブルシューティング](../../docs/troubleshooting/README.md)

## 昇格ルール
- 一つのスキルだけで使う知識は、そのスキルの参照資料に置く
- 二つ以上のスキルで再発したら、このメモリーへ昇格する
- 自動生成メモリーの内容は、再現確認してから明示ファイルへ移す
```

### desired state

```md
---
type: Desired State
---

## 生成物を再現できる
- 対象: リリース、CI、ドキュメント
- 期待状態: 生成物を再生成しても Git 差分が出ない
- 検証: `make generate && git diff --exit-code`
- 正本: `schemas/` と生成スクリプト
- 例外: 緊急修正時は issue URL を記録する
- 最終確認日: 2026-08-07
```

### troubleshooting

```md
---
type: Troubleshooting
---

## フックがヘッドレス実行で発火しない
- 適用対象: リリース、CI concierge
- 症状: 対話実行では動くが prompt mode ではログがない
- 原因: repository hook が未 trusted、または prompt mode で無効
- 検出: 有効な設定 source と起動 flag を表示する
- 復旧: trust を確認し、必要な明示 flag または環境設定を使う
- 再発防止: headless 受け入れテストを CI に追加する
- 最終確認日: 2026-08-07
```
