# `contracts/uc-index.yaml` の形

UC (ユースケース) が契約のどの要素を使うかを 1 か所にまとめた索引。
v1 は spec の summary から slice を導いたが、その情報源は v2 に無い。かわりに LLM (mode=uc) が
この索引を保守し、`compileContracts.js` / `compileRdbSchema.js` が索引から slice を切る。

## スキーマ

```yaml
schema_version: distillery2.uc-index/v1
ucs:
  - slug: loan-register              # 小文字ケバブ (^[a-z0-9]+(-[a-z0-9]+)*$)。UC の識別子
    operations:                      # この UC が使う OpenAPI operationId
      - createLoan
      - getBook
    messages:                        # この UC が使う AsyncAPI message 名 (components.messages のキー)
      - LoanCreated
    tables:                          # この UC が使う RDB テーブル名
      - loans
      - books
```

- `operations` / `messages` / `tables` は省略時は空配列とみなす。
- slug は一意。`operations` の各値は openapi.bundle に、`messages` は asyncapi.bundle の
  `components.messages` に、`tables` は rdb-schema.bundle に実在しなければならない
  (`validateUcIndex.js` が検査する)。

## 索引から作る slice

| 入力 | 出力 | 中身 |
|---|---|---|
| `operations` | `generated/slices/<slug>/contract-slice.json` の `openapi` | operation の path item と、$ref で到達する component を閉包した最小 OpenAPI |
| `messages` | 同 `asyncapi` | message を扱う operation に解決し、channel・message・payload schema を閉包した最小 AsyncAPI |
| `tables` | `generated/slices/<slug>/rdb-slice.yaml` | UC のテーブル全文 + FK 参照先を read-only な external_tables (キー列だけ) として付す |

## examples 必須ルール

UC が使う各 OpenAPI operation には、次の example が無ければ `validateUcIndex.js` が停止する:

- ドキュメント化された各 2xx / 4xx status (content を持つもの) に response example が 1 つ以上
- `requestBody` があるなら、各 response example と **同名の request example** があること
  (その status を起こす入力を契約が持つ、という意味)

### request と response の名前対応

契約テストは status ごとに「その status を起こす入力」を送る必要がある。そのため request と response の
example を **同じ名前** で対応づける:

| 要素 | 名前 |
|---|---|
| `responses.<status>.content.<mt>.examples.<name>` | この status を返すケースの名前 |
| `requestBody.content.<mt>.examples.<name>` | 同名の入力 (この status を起こす) |

- 例: 201 の response example `success` ↔ request example `success`、409 の `conflict` ↔ request `conflict`。
- request が単数形 `example` (名前なし) のときは、2xx にだけ対応づく。
- 同名の request example が無い status は、生成テストで `it.todo('<status>: request example "<name>" missing')` になる
  (誤って共通の入力を送って必ず落ちる契約テストを作らない)。

example を書けないシナリオに行き当たったら、契約を推測で埋めず、`.distillery/runs/<slug>/issues/` に
課題ドラフトを残して止まる (mode=uc の停止条件)。AsyncAPI の message example は必須ではなく、
無ければ生成テストが `it.todo` になる。
