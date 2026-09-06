# Distillery サンプル

| サンプル | 内容 |
|---|---|
| [pipeline](pipeline/README.md) | 図書館管理システム。design完了状態から、改訂したdist-specと後続工程を実行した出力 |
| [harvest](harvest/) | 既存プロジェクトからの要件取り込み |
| [preflight](preflight/README.md) | パイプライン実行前の入力検査 |

pipelineの仕様は、RDRAとdesignのlatestを参照します。
OpenAPI、AsyncAPI、RDB schemaは分割した正本から必要な領域を読み、全体をbundleで検証できます。
入力の復元方法、生成イベント、検証結果は[pipelineの実行記録](pipeline/pipeline/README.md)を参照してください。

過去の形式とfeedback履歴を使う固定テストデータは[tests/fixtures/distillery](../../tests/fixtures/distillery/README.md)にあります。
