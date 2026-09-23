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
      level: layer          # tier | layer。d2-decide の検証専用 (下記)。F2 は読まない
---
```

## F1 (genRules) が読むキー

| キー | 使い方 |
|---|---|
| `status` | `accepted` 以外は無視 |
| `id` | 差し込み順 (昇順) と arch_test 名の一部 |
| `rules[].scope` | 出力ファイルの振り分け。未知の scope は exit 1 |
| `rules[].text` | `## プロジェクトの決定から` に 1 行で差し込む |
| `tiers[].kind` | tier ファイルを生成する kind の集合 (下記ティア構成 ADR) |

## F2 (genArchTests) が読むキー

- `rules[].arch_test.{from, to, effect}`。forbid → forbidden ルール、allow → allowed。名前は `adr-<id>-<n>`。
- **`arch_test.level` (`tier` | `layer`) は読まない**。level は d2-decide の `validateAdr` が
  「ティア構成 ADR は level: tier を、app scope があれば level: layer を最低 1 つ持つ」を検査するための
  宣言であり、生成される dependency-cruiser ルールには影響しない (from/to/effect だけが規則になる)。

## ティア構成 ADR (accepted かつ非空の `tiers[]` を持つ 1 本)

```yaml
scope: [system]             # ティア構成 ADR は scope に system を含む (validateAdr が要求)
tiers:
  - { id: backend-api, dir: apps/backend-api, kind: backend, lang: typescript, provides: [api], consumes: [db] }
  - { id: frontend, dir: apps/frontend, kind: frontend, lang: typescript, provides: [], consumes: [api] }
datastore_owner: backend-api
```

- **選択規則**: `collectTiers` は「`status: accepted` かつ非空の `tiers[]` を持つ ADR」を 1 本選ぶ
  (`validateAdr` の `tierStructureErrors` と同じ条件。検証を通れば必ずちょうど 1 本)。
  「先に現れた system ADR」ではない。空の `tiers[]` を持つ system ADR を先に拾ってティアが消えるのを避ける。
- `validateAdr` はティア構成 ADR **以外**が `tiers` キーを持つこと (空配列を含む) を禁止する。
  基盤が取り違える入力は検証段階で弾かれる前提。
- F1: `tiers[].kind` の集合で tier ルールファイルを絞る。
- F5: `tiers[]` から config の `tiers[]` と apps 骨格、`datastore_owner` を作る。

## testing ADR (scope に `testing` を含む)

```yaml
scope: [testing]
capabilities: { browser: false }
```

- `validateAdr` は accepted な testing ADR に `capabilities: { browser: <bool> }` を要求し、
  `capabilities` を宣言する accepted ADR は 1 本までに制限する。
- F5: `collectCapabilities` が accepted な testing ADR の `capabilities.browser` を読み、
  config の `capabilities.browser` にする (既定 false)。false ならブラウザ受入ジョブを組まない。

## 契約入力 (contracts/contracts.json)

F5 は ADR ではなく `contracts/contracts.json` から契約を読む。形は `{ "contracts": [{id, type, source, provider, consumers}] }`。
ファイルが無ければ `contracts: []` にして警告する。
