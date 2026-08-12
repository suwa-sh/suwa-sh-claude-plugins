# preflight サンプル(影響範囲の事前調査)

`/distillery:dist-harvest --preflight` の実行例です。

## シナリオ(架空)

前任者が作った Excel マクロ 3 本で回っている「月次スケジュール登録」業務に、
「祝日を作業予定日から自動で除外したい」という変更要望が来ました。
マクロの中身(VBA)は誰も読めていません。

preflight は **VBA を 1 行も読まずに**、手順書とファイル構成メモだけから
影響範囲を判定します(結果: 判定 YES — スケジューラー登録内容が変わる)。

この事例は適用対象の代表例の 1 つです。preflight 自体は Excel マクロ専用ではなく、
全自動化された小さなツール、業務の現場で使うスマホアプリの現場での使われ方、
大規模 web app の変更前調査まで、同じ 3 つの view(システムコンテキスト / 業務フロー /
成果物チェーン)で調査できます。

## ファイル

| パス | 内容 |
|---|---|
| [input/操作手順書.md](input/操作手順書.md) | 調査の入力 1: 業務の操作手順書(抜粋) |
| [input/ファイル構成.md](input/ファイル構成.md) | 調査の入力 2: ファイル・シート構成のメモ |
| [output/preflight.md](output/preflight.md) | 調査の出力: 3 view + 影響判定 + 残質問リスト |

VBA 本文が input に無いのは意図的です(preflight は実装内部を読まないため、無くても実行できます)。

## 実行方法

```
/distillery:dist-harvest --preflight samples/distillery/preflight/input --change "01_作業予定入力.xlsm のマクロを変更し、祝日を作業予定日から自動で除外したい"
```

## output の生成手順

正式な出力先は実行プロジェクトの `docs/harvest/preflight/events/{event_id}/preflight.md`
(+ `latest/` への置換コピー)です。このサンプルの `output/preflight.md` は、
上記コマンド相当の調査(event_id `20260813_083612_preflight`)の結果を手動コピーしたものです。
再生成した場合は最新 event の preflight.md をこのパスへコピーしてください
(event_id・実行日時は実行のたびに変わります)。
