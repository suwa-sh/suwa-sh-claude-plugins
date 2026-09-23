# ADR が持つ機械可読キー (d2-foundation が読む範囲)

F1 (genRules) と F5 (genConfig / genSkeleton) が `docs/adr/NNNN-<slug>.md` の front matter から読むキーだけを定める。
正本は d2-decide の `references/adr-format.md`。ここは「基盤が実際に読むキー」に絞る (最小)。

## front matter の形

```yaml
---
id: 0002
title: レイヤ依存方向
status: accepted            # accepted の ADR だけが rules / tiers / capabilities に寄与する
scope: [backend]            # ADR の対象。配列。system / testing は特別扱い (下記)
nfr_refs: [PERF-1]          # 参考。基盤は読まない
rules:
  - scope: common | tier:frontend | tier:backend | tier:worker | tier:data-pipeline | tier:cli | tier:mcp-server | testing
    text: "ルール文 1 文"
    arch_test:              # 任意。F2 が読む
      from: "apps/backend-api/src/domain/**"
      to: "apps/backend-api/src/infrastructure/**"
      effect: forbid        # forbid | allow
---
```

## F1 (genRules) が読むキー

| キー | 使い方 |
|---|---|
| `status` | `accepted` 以外は無視 |
| `id` | 差し込み順 (昇順) と arch_test 名の一部 |
| `rules[].scope` | 出力ファイルの振り分け。未知の scope は exit 1 |
| `rules[].text` | `## プロジェクトの決定から` に 1 行で差し込む |
| `tiers[].kind` | tier ファイルを生成する kind の集合 (下記 system ADR) |

## F2 (genArchTests) が読むキー

- `rules[].arch_test.{from, to, effect}`。forbid → forbidden ルール、allow → allowed。名前は `adr-<id>-<n>`。

## system ADR (scope に `system` を含む)

```yaml
scope: [system]
tiers:
  - { id: backend-api, dir: apps/backend-api, kind: backend, lang: typescript, provides: [api], consumes: [db] }
  - { id: frontend, dir: apps/frontend, kind: frontend, lang: typescript, provides: [], consumes: [api] }
datastore_owner: backend-api
```

- F1: `tiers[].kind` の集合で tier ルールファイルを絞る。
- F5: `tiers[]` から config の `tiers[]` と apps 骨格、`datastore_owner` を作る。

## testing ADR (scope に `testing` を含む)

```yaml
scope: [testing]
capabilities: { browser: false }
```

- F5: `capabilities.browser` を config の `capabilities.browser` にする (既定 false)。

## 契約入力 (contracts/contracts.json)

F5 は ADR ではなく `contracts/contracts.json` から契約を読む。形は `{ "contracts": [{id, type, source, provider, consumers}] }`。
ファイルが無ければ `contracts: []` にして警告する。
