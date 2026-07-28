# 実装先リポのレイアウト 正本(distillery-impl)

mono repo。tier ごとにディレクトリを分け(並走実装の write-set 分離)、4 段テストを配置する。
tier とディレクトリの対応は **`impl-config.yaml` の `tiers[].dir` 宣言が正**(固定 3 種ではない)。

```
{repo_root}/
  {tiers[].dir}/                   # 実装 tier ごと。例 frontend/ backend-api/ worker/
    src/                           # 実装本体
    test/                          # ④ TDD 単体(命名: テスト対象_XXXの場合_YYYであること + AAA)
    features/                      # ③ tier BDD({uc_id}.feature + steps/)
  packages/
    contracts/                     # 契約 codegen 出力(S4 実行中 read-only。再生成は S0/S3 のみ)
      api-types/                   # openapi → 型
      api-client/                  # openapi → クライアント(frontend が使用)
      server-stubs/                # openapi → サーバスタブ(backend が使用)
      async-types/                 # asyncapi → 型(has_asyncapi の場合のみ)
    ui/                            # design の storybook-app 由来(has_design_system の場合のみ)
      components/ tokens/ stories/ # storybook-app/src/ の実ファイル列挙で取り込み(bootstrap P5)
      .imported.yaml               # 取り込み元 design event_id とファイル一覧
  features/
    uc/{uc_id}.feature             # ② UC BDD(integration writer 所有)
    uc/steps/
    atdd/{spec_id}.feature         # ① ATDD(S0 で全 SPEC 分生成。integration writer 所有)
    atdd/steps/
  {datastore 資産}                  # migration/schema。impl-config の datastore_owner tier の dir 配下
  docs/dev-rules/                  # dev-rules 正本のコピー(bootstrap が配布)
  CLAUDE.md                        # bootstrap が生成(dev-rules 抜粋 + プロジェクト固有規約)
  .qlty/qlty.toml                  # qlty(formatter/linter/SAST)
  .github/workflows/ci.yml         # 6 段ゲート(下記)
```

## CI(6 段ゲート)の job 構成

`ci.yml` はゲートを job に分割し、順序依存を needs で表現する:

```
format-check → lint → tdd(tier 並列 matrix) → tier-bdd(tier 並列 matrix) → uc-bdd → atdd
```

- コマンドは impl-config.yaml の `commands` / `integration_commands` と一致させる(bootstrap が生成時に転記)
- ローカル(S4〜S7)と CI が**同じコマンド**を使うことで「ローカル green = CI green」を保つ

## 命名規則

- tier ディレクトリ名 = tier id から `tier-` プレフィックスを除いた名前を既定とする(宣言で上書き可)
- feature ファイル名は uc_id / spec_id のみ(日本語パス禁止。対応表は uc-map.yaml)
