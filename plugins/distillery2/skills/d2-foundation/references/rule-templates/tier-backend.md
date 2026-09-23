# backend ティアのルール

- **入力**: 自ティアが provider の契約 (OpenAPI) の生成物、DB 契約 (RDB schema)、UC の `.feature`。
- OpenAPI の provider なら、入出力型・ルーティングは `packages/contracts` の生成物起点。ハンドラ実装だけを書く。
- データモデルは RDB 契約が正。migration は `datastore_owner` ティアの `migrations/` が所有する。
- ドメインロジックは値オブジェクト化・集約境界・貧血モデル回避を守る (ddd の戦術設計の基準)。
- 5 層 (presentation / usecase / domain / repository / gateway) の依存方向はアーキテストが強制する。
