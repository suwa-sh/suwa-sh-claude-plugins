# 分割OpenAPI（draft）

人が編集する正本は `openapi.yaml` と `paths/`・`components/`。`contracts.json` は4操作の所有・利用対応だけを保持する。
Swagger UIには `generated/openapi.bundle.yaml` を渡す。summary・slice・bundleは直接編集しない。

同一4操作の既存契約を分割した。新たな貸出日数、永久保存receipt、DB方式は採用していない。
元出力から冪等性の24時間を確定値として継承せず、未決定の技術仕様として明示する。
RDRA業務条件の不足はpipeline還流へ送る。3依存UCは契約所有先を示す参考コンテキストであり、今回の受入対象ではない。

## 実行記録

2026-09-06: 現行 `pipeline-opus-medium/specs/latest` のネイティブOpenAPIから、既存spec-readyと同じ4 operationの参照closureを抽出し、人編集用YAMLへ分割。
Redocly 2.51.1を用い、変更後のcompileContracts.jsを実行。10生成物（bundle、4UCのsummary/slice、manifest）を出力。
実行コマンドは `node <skill>/scripts/compileContracts.js <event-dir>`。`--check` で再生成一致を確認。
これは改訂スキルの契約工程の実行結果であり、4UCのアプリ実装・E2E成功を意味しない。
