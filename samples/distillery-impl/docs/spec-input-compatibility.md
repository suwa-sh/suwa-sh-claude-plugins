# 新構成のdist-impl入力互換性確認

対象: [公開pipelineサンプル](../../distillery/pipeline/specs/latest/README.md)。確認日: 2026-09-06。

| 確認項目 | 結果 |
|---|---|
| OpenAPI入口 | openapi/openapi.yaml |
| AsyncAPI入口 | asyncapi/asyncapi.yaml |
| API正本とbundleの一致 | current |
| UC summaryとsliceの内容・SHA-256 | 27 UCで成功 |
| AsyncAPI存在プローブ | has_asyncapi: true |
| RDB bundleとdomain slice | 5 domain / 17 tableで成功 |

確認は /private/tmp の仕様コピーに対し、compileContracts --check、validateSummary、compileRdbSchema --checkを実行した。

今回の確認範囲は入力契約の整合性とスキルの読込規約。新構成を入力にしたdist-implのS0〜S9全体、codegen、アプリ実装の実行確認は含まない。
