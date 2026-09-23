# ADR フォーマット (distillery2)

アーキテクチャ決定記録 (Architecture Decision Record)。adr-tools の連番慣習に従う。
1 決定 = 1 ファイル `docs/adr/NNNN-<slug>.md`。番号は 0001 から連番、ファイル名の番号と front matter の `id` を一致させる。

## ファイル構造

先頭に YAML front matter (`---` で挟む)、続けて Markdown 本文。本文は日本語で 背景 / 決定 / 却下した案 / 影響 の 4 節。

```markdown
---
id: "0003"
title: "API ティアは Express で実装する"
status: accepted            # proposed | accepted | superseded | deprecated
date: 2026-09-23
supersedes: []              # 置き換えた ADR の id 配列
superseded_by: null         # この ADR を置き換えた ADR の id (無ければ null)
basis: requirements@<sha>    # scripts/lib/basis.js で付ける
nfr_refs: ["B.1.1"]         # 動機になった nfr-grade のメトリクス id (任意)
scope: [system, app]        # system | app | data | infra | ui | testing のうち 1 つ以上
confidence: low             # high | medium | low (任意。low は人の確認対象)
rules:                      # 機械可読。段階③ (d2-foundation) の rules 生成 / arch test の入力
  - scope: tier:backend     # common | testing | tier:<kind>
    text: "backend-api は domain 層から infrastructure 層へ依存してはならない"
    arch_test:              # 任意。依存規則をアーキテストにする
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid        # forbid | allow
---

# 背景

なぜこの決定が要るか。RDRA / NFR のどの要素が動機かを 1〜3 文で。

# 決定

何を選んだか。断定形で書く。

# 却下した案

- 案 A: 却下理由。
- 案 B: 却下理由。

# 影響

この決定がもたらす正負の帰結。
```

## front matter フィールド

| フィールド | 必須 | 説明 |
|---|---|---|
| `id` | ✓ | 4 桁ゼロ埋め。必ずクォートする (`"0003"`。0 始まりが数値化しないため) |
| `title` | ✓ | 決定の要約 |
| `status` | ✓ | `proposed` / `accepted` / `superseded` / `deprecated` |
| `date` | ✓ | `YYYY-MM-DD` |
| `supersedes` | | 置き換えた ADR の id 配列 (既定 `[]`) |
| `superseded_by` | | 置き換えた側の id、無ければ `null` |
| `basis` | ✓ | `requirements@<sha>` |
| `nfr_refs` | | nfr-grade のメトリクス id 配列 |
| `scope` | ✓ | `system` / `app` / `data` / `infra` / `ui` / `testing` から 1 つ以上 |
| `confidence` | | `high` / `medium` / `low`。auto-adopt で推奨案を採ったものは `low` を付け、レビューで人が確認する |
| `rules` | | 機械可読ルール配列。下記 |

## rules[] の形

段階③ の `genRules` / `genArchTests` がこの配列を消費する。人が rules 文書を直接編集しない前提。

- `scope`: `common` (全ティア) / `testing` / `tier:<kind>` (`tier:frontend` `tier:backend` `tier:worker` 等)。
- `text`: `docs/rules/*.md` に転記される 1 文。
- `arch_test` (任意): `from` / `to` (glob) と `effect` (`forbid` / `allow`)。依存方向のアーキテストになる。

## 段階③が読む追加の front matter (ティア構成 / テスト方針の ADR)

`rules[]` のほかに、次のキーを特定の ADR が持つ。d2-foundation の `genConfig` / `genSkeleton` / `genRules` が読む
(正本: `../../d2-foundation/references/adr-inputs.md`)。`status: accepted` の ADR だけが寄与する。

```yaml
# ティア構成の ADR (scope に system を含む) — 必須
tiers:
  - id: backend-api            # apps/ 配下のディレクトリ名と同じ
    dir: apps/backend-api
    kind: backend              # frontend | backend | worker | data-pipeline | cli | mcp-server
    lang: typescript
    provides: [api, events]    # 提供する契約 id (contracts.json と一致させる。骨格前は空でよい)
    consumes: [db]
datastore_owner: backend-api   # migration を持つティア

# テスト方針の ADR (scope に testing を含む) — 任意
capabilities:
  browser: false               # @browser シナリオをブラウザドライバで実行するか (既定 false)

# UI 部品の方針の ADR (scope に ui を含む) — 任意。d2-design がヒントとして読む
ui:
  framework: next              # 例。ベンダー名でなく方式で書く
  design_system: true
```

## status 遷移と参照整合性 (validateAdr が検査)

- `superseded_by` を持つ ADR は `status: superseded`。
- `A.superseded_by = B` なら `B.supersedes` に `A.id` を含める (双方向リンク)。逆も同様。
- 参照先が存在しない (dangling) / id 重複はエラー。

## ティア構成 / テスト方針の追加 front matter (validateAdr が検査)

- `scope` に `system` を含む `status: accepted` の ADR は `tiers[]` を持つ (空は不可)。各 tier は
  `id` / `dir` / `kind` (`frontend` | `backend` | `worker` | `data-pipeline` | `cli` | `mcp-server`) / `lang` が必須。
- 同じ ADR は `datastore_owner` を持ち、その値は自分の `tiers[].id` のいずれかと一致させる。
- `tiers[]` を宣言する `accepted` ADR は 1 つだけ (2 つ以上はエラー)。
- `capabilities` は任意。あるなら `{ browser: boolean }` の形 (それ以外のキーはエラー)。

## 検証と索引生成

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/validateAdr.js docs/adr
node ${CLAUDE_PLUGIN_ROOT}/skills/d2-decide/scripts/genAdrIndex.js docs/adr docs/adr/index.md requirements=docs/requirements
```

`genAdrIndex` は id 昇順で `docs/adr/index.md` を決定論的に生成する。
