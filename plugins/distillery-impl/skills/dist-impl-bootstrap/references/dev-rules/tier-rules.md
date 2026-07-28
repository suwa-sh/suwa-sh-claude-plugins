# tier 種別規約 正本(distillery-impl)

実装 tier は `impl-config.yaml` の `tiers[]` 宣言が正。ここでは tier 種別ごとの実装規約を定める。
どの tier がどの種別かは tier id の意味(frontend / backend / worker)から bootstrap が判定して
impl-config に記録する。

## frontend 系(例: tier-frontend)

- **入力**: `tier-frontend.md`(画面仕様・コンポーネントマッピング・操作フロー)+
  `docs/design/latest/design-event.yaml` の `screens[]`(uc / story / variants)
- **UI コンポーネントは `packages/ui/` のみ使用**。`packages/ui/` は
  `docs/design/latest/storybook-app/src/`(components / tokens / stories と依存モジュール)を
  bootstrap が実ファイル列挙で取り込んだもの(design-event.yaml はコンポーネント名と
  screen 結線の照合にのみ使う。`.imported.yaml` が取り込みの記録)
- 不足コンポーネント・不足 variant は自作せず、design への変更要求(issues/ → change-requests/)を経由する
- 画面と UC の結線は design-event.yaml の `screens[].uc` が正。結線が無い UC は S1 が警告済みのはず
  (素の packages/ui 部品で組む選択がユーザー合意済みの場合のみ進む)
- API 呼び出しは `packages/contracts/api-client`(生成物)経由。fetch/axios の直書き禁止

## backend 系(例: tier-backend-api)

- **入力**: `tier-backend-api.md`(API 仕様表・データモデル変更表・ビジネスルール)+
  `_api-summary.yaml` / `_model-summary.yaml`
- API の入出力型・ルーティングは `packages/contracts/server-stubs` / `api-types`(生成物)起点。
  ハンドラ実装だけを書く
- データモデルは `_cross-cutting/datastore/rdb-schema.yaml`(+ kvs-schema.yaml)が正。
  migration は `datastore_owner` tier(impl-config 宣言)が所有する
- ドメインロジックは ddd-tactical-implementation の基準で刻む(集約 1 Tx 1 個・ID 参照・値オブジェクト化)

## worker 系(例: tier-worker)

- **入力**: `tier-worker.md`(イベント処理仕様)+ asyncapi 生成型(`packages/contracts/async-types`)
- asyncapi が無い環境(capability `has_asyncapi: false`)では `_api-summary.yaml` の `async_events[]` から
  型を起こす(縮退モード。contract-codegen.md 参照)
- 冪等性: イベント再配送を前提に、処理は冪等に書く(tier-*.md の冪等性欄が正)

## datastore 資産(実装 tier ではない)

- architecture tier に `tier-datastore` 等があっても、それは**実装 tier ではなく共有資産**
- migration / schema 定義ファイルは `datastore_owner` に宣言された tier のディレクトリ配下に置く
