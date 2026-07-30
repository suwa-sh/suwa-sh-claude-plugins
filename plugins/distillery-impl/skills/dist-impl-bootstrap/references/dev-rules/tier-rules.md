# tier 種別規約 正本(distillery-impl)

実装 tier は `impl-config.yaml` の `tiers[]` 宣言が正。ここでは tier 種別ごとの実装規約を定める。
どの tier がどの種別か(frontend / backend / worker / data-pipeline / cli / mcp-server)は
tier id の意味と tier md の構成から bootstrap が判定して impl-config に記録する。

**全種別共通**: tier 間の依存面は `impl-config.yaml` の `contracts[]` 宣言が正
(実装リポで読める対応物は contracts[] の source と `docs/impl/latest/contracts.lock.yaml` の
generated[]。種別定義の正本は distillery-impl プラグイン側の contract-registry.md)。
自 tier が provider / consumers に含まれる契約の生成物・source だけを読み、
契約に無い tier 間依存が必要になったら実装で直接依存せず issues → feedback で契約宣言の
追加を要求する。

## frontend 系(例: tier-frontend)

- **入力**: `tier-frontend.md`(画面仕様・コンポーネントマッピング・操作フロー)+
  `docs/design/latest/design-event.yaml` の `screens[]`(uc / story / variants)
- **UI コンポーネントは `packages/ui/` のみ使用**。`packages/ui/` は
  `docs/design/latest/storybook-app/src/`(components / tokens / stories と依存モジュール)を
  bootstrap が実ファイル列挙で取り込んだもの(design-event.yaml はコンポーネント名と
  screen 結線の照合にのみ使う。`.imported.yaml` が取り込みの記録)
- 不足コンポーネント・不足variantは自作せず、designへの変更要求（issues/ → 単一feedback draft）を経由する
- 画面と UC の結線は design-event.yaml の `screens[].uc` が正。結線が無い UC は S1 が警告済みのはず
  (素の packages/ui 部品で組む選択がユーザー合意済みの場合のみ進む)
- openapi 契約の consumer である場合、API 呼び出しは `packages/contracts/api-client`(生成物)経由。
  fetch/axios の直書き禁止

## backend 系(例: tier-backend-api)

- **入力**: `tier-backend-api.md`(API 仕様表・データモデル変更表・ビジネスルール)+
  `_api-summary.yaml` / `_model-summary.yaml`
- openapi 契約の provider である場合、API の入出力型・ルーティングは
  `packages/contracts/server-stubs` / `api-types`(生成物)起点。ハンドラ実装だけを書く
- データモデルは `_cross-cutting/datastore/rdb-schema.yaml`(+ kvs-schema.yaml)が正。
  migration は `datastore_owner` tier(impl-config 宣言)が所有する。
  ただし contracts[] で provider が宣言されたテーブル群(例: data pipeline の mart)は
  その provider が DDL/migration を所有し、backend は consumer として生成型経由で読む
- ドメインロジックは ddd-tactical-implementation の基準で刻む(集約 1 Tx 1 個・ID 参照・値オブジェクト化)

## worker 系(例: tier-worker)

- **入力**: `tier-worker.md`(イベント処理仕様)+ 自 tier が関与する契約の生成型
  (asyncapi 契約が宣言されていれば `packages/contracts/async-types`)
- asyncapi が無い環境(capability `has_asyncapi: false`)では `_api-summary.yaml` の `async_events[]` から
  型を起こす(縮退モード。生成するのは bootstrap P4 であり、Implementer は生成物を使うだけ)
- 冪等性: イベント再配送を前提に、処理は冪等に書く(tier-*.md の冪等性欄が正)

## data-pipeline 系(例: tier-data-pipeline)

- **入力**: `tier-data-pipeline.md`(変換・集計仕様)+ 自 tier が関与する契約
  (consumer として上流データレイアウト、provider として出力 mart レイアウト —
  `packages/contracts/` の生成型 + source schema)
- **出力レイアウト(mart 等)は契約が正**。実装の都合で列・型・粒度を変えない(変更要求経由)。
  consumer(backend 等)はこのレイアウトを read model として読む
- mart の DDL / migration は provider として自 tier の dir 配下に所有する
- 再実行安全: ジョブは冪等(同一入力での再実行が同一結果)に書き、部分失敗からの再開を前提にする

## cli 系(例: tier-cli)

- **入力**: `tier-cli.md`(コマンド仕様)+ 自 tier が関与する契約の生成型
- コマンド体系・引数・入出力形式が契約面。仕様の記載から転写する(実装の都合で変えない)
- exit code は成功 0 / 失敗非 0。データ出力は stdout、ログ・診断は stderr に分離する
- 対話プロンプトは非対話フラグで抑止できるようにする(CI・パイプラインからの利用を前提)

## mcp-server 系(例: tier-mcp-server)

- **入力**: `tier-mcp-server.md`(tool 仕様)+ 自 tier が関与する契約の生成型
- tool 名・入出力 JSON Schema・エラー形式が契約面。スキーマからの逸脱は変更要求経由
- tool の description・スキーマは仕様の記載から転写する(実装の都合で意訳しない)

## datastore 資産(実装 tier ではない)

- architecture tier に `tier-datastore` 等があっても、それは**実装 tier ではなく共有資産**
- migration / schema 定義ファイルは `datastore_owner` に宣言された tier のディレクトリ配下に置く
  (contracts[] で provider が宣言された資産は provider tier の配下)
