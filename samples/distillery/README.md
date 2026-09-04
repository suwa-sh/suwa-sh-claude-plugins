# distillery 出力サンプル

| ディレクトリ | 実行モード | 題材 |
|---|---|---|
| [pipeline-opus-medium/](pipeline-opus-medium/) | 初期要望テキストからのフル実行 + feedback 往復 2 run | 図書館蔵書管理システム |
| [pipeline-fable-low/](pipeline-fable-low/) | 同じ初期要望からのフル実行のみ（モデル比較用） | 図書館蔵書管理システム |
| [harvest/](harvest/) | 既存プロジェクトからの逆生成（`/distillery:dist-harvest`） | 図書館システム（[system-sekkei/library](https://github.com/system-sekkei/library)） |
| [preflight/](preflight/) | 影響範囲の事前調査（`/distillery:dist-harvest --preflight`） | Excel マクロ業務 / [tbm-template](https://github.com/suwa-sh/tbm-template) / [asana-register-routines](https://github.com/suwa-sh/asana-register-routines) |

いずれも独立した実行例です。harvest/ の usdm・rdra は逆生成イベント（`harvest_initial`）由来で、pipeline 側（`initial_build` 由来）とは無関係です。

## pipeline サンプルの内訳

どちらも同じ [初期要望テキスト](pipeline-opus-medium/input/初期要望.txt) を入力に、distillery 1.9.x の `/distillery:dist-pipeline` を auto_adopt・headless で実行しています。
出力は usdm → rdra → nfr → arch → infra → design → specs。各 `latest/_digest/`（段階的開示用の索引）と `pipeline/token-report/`（エージェント別トークン集計）を含みます。

`pipeline-opus-medium/` はさらに feedback 往復を 2 run 含みます。

- run 1: 実装からの変更要求 11 件を `--recommended-auto` で work unit へ route し、design_system → spec → spec_stories の 3 stage で全件 applied
- run 2: run 1 を `supersedes` する再送（2 件）。各 stage が残存ギャップを検出して applied、spec_stories は no-change

## モデル・effort による違い

同じ入力・同じ pipeline-config で、モデルと effort だけを変えた実行結果です。

| | pipeline-opus-medium | pipeline-fable-low |
|---|---|---|
| モデル × effort | Opus 5 × medium | Fable 5.1 × low |
| 業務 / BUC / UC | 7 / 13 / 41 | 6 / 10 / 27 |
| 情報 / 状態モデル / 条件 | 7 / 6 / 17 | 9 / 3 / 14 |
| サブドメイン / BC / ティア | 5 / 7 / 9 | 5 / 6 / 8 |
| API / 非同期イベント | 45 / 6 | 30 / 13 |
| UC 仕様 / Story | 41 / 79 | 27 / 57 |

フル実行区間のトークン実測値です。feedback run は fable 側に無いため除いています。

| | pipeline-opus-medium | pipeline-fable-low |
|---|---:|---:|
| サブエージェント数 | 117 | 116 |
| cache creation | 14,008,425 | 15,664,230 |
| cache read | 290,613,829 | 204,460,681 |
| output | 832,751 | 326,772 |

Fable 5.1 × low は同じ要望から一回り小さいモデルを構築し、cache read で約 30%、output で約 60% 少なく済んでいます。
UC を 41 と 27 のどちらに割るかは要件の粒度判断であり、どちらかが誤りではありません。

> **Note**: `pipeline-fable-low/` は Fable の週次上限に達したため、Step6 の確定処理以降（`specs/latest/` の確定、spec-event.yaml、Step6a、Step6b）だけを Opus 5 × medium で実行しています。要件・設計・UC 仕様の本文は Fable 5.1 × low の生成物です。Step6a は両サンプルとも pipeline-config で sonnet を指定しています。
