# distillery 出力サンプル

実行モード別に2つのサンプルを収録しています。

| ディレクトリ | 実行モード | 題材 |
|---|---|---|
| [pipeline/](pipeline/) | 初期要望テキストからのフルパイプライン実行（`/distillery:dist-pipeline`）。usdm → rdra → nfr → arch → infra → design → specs の全ステージ成果物 | 図書館蔵書管理システム（初期要望テキスト起点） |
| [harvest/](harvest/) | 既存プロジェクトからの逆生成（`/distillery:dist-harvest`）。as-is 解析ドキュメント（evidence / confidence 付き） | 図書館システム（[system-sekkei/library](https://github.com/system-sekkei/library) の実コード起点） |

> **Note**: 2つは別々の実行例です。harvest/ の後段成果物（usdm/rdra 以降）は pipeline/ には含まれていません。
