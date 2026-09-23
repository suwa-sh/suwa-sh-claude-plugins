# 対象リポのレイアウト (distillery2)

一般的なモノレポ + Cucumber + Playwright の慣習に収める。v1 の独自テストディレクトリ (`features/uc`、
`features/atdd`、ティア別 `features/`、`tools/*-tests`、`docs/impl`) は作らない。

```
<repo>/
  apps/
    <tier>/                        # config の tiers[].dir。例 frontend / backend-api / worker
      src/                         # 実装本体。単体テストは *.test.ts を同居
      test/contract/               # 契約テスト (契約から生成。F4 / d2-contract)
      migrations/                  # datastore_owner だけ。DB 契約から生成
  packages/
    contracts/                     # 契約からの codegen 出力 (型・クライアント・stub)
    ui/                            # design tokens + 部品 + stories (F6 が取り込む)
    test-support/                  # tracer + pglite harness (F3)
      src/{tracer.ts, pglite-harness.ts, index.ts}
      README.md                    # 実装者が結線するもの (d2-implement mode=integrate が読む)
  features/                        # Cucumber 既定構成
    <業務>/<uc_slug>.feature       # UC BDD。@uc:<slug> と @acceptance:<SPEC>-<n> タグ
    acceptance/*.feature           # UC をまたぐ受入基準だけ
    step_definitions/              # step 実装 (d2-implement)
    support/
      world.ts                     # タグ @browser でドライバを選ぶ World
      hooks.ts                     # Before で scenario_id + トレース文脈、After で teardown
      drivers/{types.ts, api.ts, browser.ts}
  docs/
    requirements/  nfr/  adr/  rules/  design/  as-built/
  contracts/
    openapi/ asyncapi/ db/  contracts.json  generated/
  .distillery/config.yaml          # 実行設定 (config-schema.md)
  .dependency-cruiser.cjs          # F2
  .github/workflows/ci.yml         # F5 (genCi)
  cucumber.js  package.json  tsconfig.base.json  .gitignore
```

## 命名

- tier ディレクトリ名は config の `tiers[].dir` が正 (既定は tier id)。
- UC 系 feature は `<uc_slug>` (use-cases.yaml の slug、kebab-case)。step 定義も同じ slug。
- 契約テストは `apps/<provider>/test/contract/<operationId>.test.ts`。

## 生成物と手編集の境界

- `basis:` ヘッダを持つ生成物 (docs/rules、.dependency-cruiser.cjs、config.yaml、packages/ui/.imported.yaml) は
  再生成で上書きする。直したい変更は上流 (ADR・契約・design) に戻す。
- 骨格 (package.json、tsconfig.base.json、apps/packages のディレクトリ) は既存を上書きしない。
