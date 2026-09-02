# distillery 出力サンプル

実行モード別に2つのサンプルを収録しています。

| ディレクトリ | 実行モード | 題材 |
|---|---|---|
| [pipeline/](pipeline/) | 初期要望テキスト（[input/初期要望.txt](pipeline/input/初期要望.txt)）からのフル実行（distillery 1.9.2、auto_adopt、headless）に加え、単一 feedback-request Markdown（[feedback-requests/](pipeline/feedback-requests/)、11 件）を `--recommended-auto` で内部 work unit へ route し、design_system → spec → spec_stories の 3 stage で 11 件すべてを applied として記録した往復例（run 1）。さらに run 1 を `supersedes` する再送 request（CR-002 / CR-006 の 2 件）を run 2 として処理し、各 stage が残存ギャップを検出して applied、spec_stories は no-change で終える例も含む。usdm → rdra → nfr → arch → infra → design → specs。各 `latest/_digest/`（段階的開示用の索引）と `pipeline/token-report/`（エージェント別トークン集計）を含む | 図書館蔵書管理システム（7 業務 / 13 BUC / 41 UC。初期要望＋実装 feedback 起点） |
| [harvest/](harvest/) | 既存プロジェクトからの逆生成（`/distillery:dist-harvest`）。as-is 解析ドキュメント（harvest/）＋逆生成された USDM（usdm/）＋ RDRA モデル（rdra/）の3点セット | 図書館システム（[system-sekkei/library](https://github.com/system-sekkei/library) の実コード起点） |
| [preflight/](preflight/) | 影響範囲の事前調査（`/distillery:dist-harvest --preflight`）。実装内部を読まずに 3 view（システムコンテキスト / 業務フロー / 成果物チェーン）で整理し、変更の影響を判定する軽量パス | 3 事例: 架空 Excel マクロ業務（手順書起点・VBA 非開示）/ 実在データパイプライン [tbm-template](https://github.com/suwa-sh/tbm-template)（SQL 非読）/ 実在 GAS 小ツール [asana-register-routines](https://github.com/suwa-sh/asana-register-routines)（GAS 非読） |

> **Note**: 2つは別々の実行例です。harvest/ 配下の usdm・rdra は逆生成イベント（`harvest_initial`）由来で、pipeline/ 配下の usdm・rdra（`initial_build` 由来）とは独立しています。
