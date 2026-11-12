# 決定のスクリプトが検査するもの・描くもの

## validateAdr.js が検査するもの

| 検査 | 内容 |
|---|---|
| スキーマ | front matter の形 |
| id | 一意である |
| 参照整合性 | supersedes / superseded_by が双方向である |
| status | 遷移が正しい |
| `rules[].scope` | 書式が正しい |
| ティア構成の ADR | ちょうど 1 本ある (system scope)。tiers キーは、他の ADR に持たせない |
| テスト方針の ADR | accepted な testing ADR の `capabilities.browser` の宣言は 1 本までである |
| `rules[]` のカバレッジ | 該当 scope の rules が必須である。ティア間は `level: tier`、レイヤは `level: layer` の `arch_test` を持つ |
| 題 | 60 字までである。別の ADR の番号から始まらない |

## genArchitectureDoc.js が描くもの

「決めたもの」の C4 図 (`docs/adr/architecture.md`) を、決定論的に描く。

入力:

- accepted な ADR (ティア構成 ADR の `tiers[]` / `datastore_owner` / 任意の `contexts[]`)
- `contracts/contracts.json`
- RDRA の `アクター.tsv` / `外部システム.tsv`

出力する図:

| 図 | 条件 |
|---|---|
| システムコンテキスト図 | いつも出す |
| コンテナ図 | いつも出す |
| コンテキストマップ (flowchart) | `contexts[]` があるとき |

システムコンテキスト図とコンテナ図は、どちらも Mermaid の `graph` で描く。
C4Context / C4Container 記法は、レンダラで崩れて読みづらいため使わない。

契約と RDRA は任意である。
無ければ、その図を省くか、ティアのみ描く。

実態の依存図は、段階④の `docs/as-built/_system/dependency-graph.md` が別に描く。

## genAdrIndex.js が生成するもの

id 昇順で、決定論的に `index.md` を生成する。
`architecture.md` があれば、その C4 図へのリンクを載せる。
