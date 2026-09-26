# `.distillery/config.yaml` の形

対象プロジェクトの実行設定。段階③ (d2-foundation phase=F5) が ADR と契約カタログから生成し、人が確認する。
`d2-run` と `scripts/runGates.js` が読む。v1 の `impl-config.yaml` を次の点で簡素化した:
`specs_root` / `repo_root` の分離を廃止 (同一リポ)、ティアごとの BDD コマンドを廃止 (ティア BDD は契約テストに置換)、
`capabilities.ui_review` を `capabilities.browser` に統合。

```yaml
schema_version: "2.0"
docs_root: docs                      # 要求・ADR・as-built の置き場 (既定 docs)
tiers:
  - id: backend-api                  # ティア id (= apps/ 配下のディレクトリ名)
    dir: apps/backend-api
    kind: backend                    # frontend | backend | worker | data-pipeline | cli | mcp-server
    lang: typescript
    provides: [api, events]          # 提供する契約 id
    consumes: [db]                   # 消費する契約 id
    commands:                        # ゲートが実行するコマンド。{report} はレポート出力先に置換される
      format_check: npm run format:check -w apps/backend-api
      lint: npm run lint -w apps/backend-api
      typecheck: npm run typecheck -w apps/backend-api
      unit: npm run test -w apps/backend-api -- --reporter=json --outputFile={report}
      contract: npm run test:contract -w apps/backend-api -- --reporter=json --outputFile={report}
datastore_owner: backend-api         # migration を持つティア
contracts:
  - id: api
    type: openapi                    # openapi | asyncapi | rdb-schema (契約レジストリで追加可)
    source: contracts/openapi/openapi.yaml
    provider: backend-api
    consumers: [frontend]
  - id: events
    type: asyncapi
    source: contracts/asyncapi/asyncapi.yaml
    provider: backend-api
    consumers: [worker]
  - id: db
    type: rdb-schema
    source: contracts/db/rdb-schema.yaml
    provider: backend-api
    consumers: [worker]
commands:                            # ティアをまたぐコマンド。{slug} は UC slug、{report} はレポート出力先
  arch_test: npx depcruise --config .dependency-cruiser.cjs --output-type err apps packages
  quality: qlty check --all --no-fix --no-progress --no-upgrade-check --no-formatters --fail-level medium   # lint + SAST (qlty)。static ゲートでリポ全体に 1 回
  uc_bdd: npx cucumber-js --tags "@uc:{slug}" --format json:{report}
  acceptance_api: npx cucumber-js --tags "@uc:{slug} and @acceptance and not @browser" --format json:{report}
  acceptance_browser: npx cucumber-js --tags "@uc:{slug} and @acceptance and @browser" --format json:{report}
capabilities:
  browser: false                     # true のとき受入ゲートで acceptance_browser も実行する
  has_asyncapi: true
  has_kvs: false
  has_design_system: true
models:
  implementer: null                  # null = セッション既定モデル。d2-run が実際のモデル名に解決する
  verifier: opus                     # Agent/Task の model パラメータに渡せる有効値 (opus / sonnet / haiku 等)。
                                     # `claude-opus-5` のようなフル ID は model パラメータとして無効なので使わない。
                                     # implementer と同じにしてはいけない (独立検証の条件)
```

- `verifier` は `Agent` / `Task` ツールの `model` パラメータへそのまま渡せる短い別名 (`opus` / `sonnet` / `haiku` など) を書く。フルのモデル ID は `model` パラメータとして無効になる。
- `implementer: null` はセッション既定モデルを指す。d2-run は起動時に implementer を実際のモデル名へ解決し、`verifier` と一致していないことを確認する。一致するときは独立検証が成立しないため停止して確認する。

## ゲートとコマンドの対応

| ゲート | 実行するもの | 並列 |
|---|---|---|
| static | 各ティアの `format_check` / `lint` / `typecheck` と `commands.arch_test`、`commands.quality` (qlty。リポ全体で 1 回) | ティア並列 |
| unit | 各ティアの `unit` | ティア並列 |
| contract | 契約の提供側ティア (`contracts[].provider` / `tiers[].provides`) の `contract` だけ。消費側は skipped (not a provider)。提供側が無ければ pass (検査対象なし) | ティア並列 |
| uc-bdd | `commands.uc_bdd` | 単発 |
| acceptance | `commands.acceptance_api`、`capabilities.browser` が true なら続けて `commands.acceptance_browser` | 順次 |

無いコマンドは skip として記録する (失敗にはしない)。判定は終了コードだけ (v1 gates.md と同じ)。
