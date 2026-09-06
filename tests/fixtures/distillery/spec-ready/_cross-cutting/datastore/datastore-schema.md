# データストア定義の索引

| 正本 | 内容 |
|---|---|
| [rdb-schema.yaml](rdb-schema.yaml) | books / users / loans / reservations / api_operation_resultsの型と制約 |
| [loan-commit.md](loan-commit.md) | 貸出登録の排他・原子性・成功結果の再送・保存期間 |
| [kvs-schema.yaml](kvs-schema.yaml) | このスコープでは利用なし |

列の説明をこのファイルへ再掲しない。各UCの_model-summary.yamlは操作と値だけを定義する。
