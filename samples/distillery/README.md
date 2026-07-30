# distillery 出力サンプル

実行モード別に2つのサンプルを収録しています。

| ディレクトリ | 実行モード | 題材 |
|---|---|---|
| [pipeline/](pipeline/) | 初期要望テキストからのフル実行に加え、単一feedback-request Markdownを内部work unitへrouteし、既反映6件と未反映5件を1回で判定・記録する往復例。usdm → rdra → nfr → arch → infra → design → specs | 図書館蔵書管理システム（初期要望＋実装feedback起点） |
| [harvest/](harvest/) | 既存プロジェクトからの逆生成（`/distillery:dist-harvest`）。as-is 解析ドキュメント（harvest/）＋逆生成された USDM（usdm/）＋ RDRA モデル（rdra/）の3点セット | 図書館システム（[system-sekkei/library](https://github.com/system-sekkei/library) の実コード起点） |

> **Note**: 2つは別々の実行例です。harvest/ 配下の usdm・rdra は逆生成イベント（`harvest_initial`）由来で、pipeline/ 配下の usdm・rdra（`initial_build` 由来）とは独立しています。
