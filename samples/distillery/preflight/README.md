# preflight サンプル(影響範囲の事前調査)

`/distillery:dist-harvest --preflight` の実行例です。preflight は実装内部(コード本文・バイナリ)を
読まずに、外側から読める資料だけで対象を 3 つの view(システムコンテキスト / 業務フロー /
成果物チェーン)に整理し、外部影響境界での変更影響を YES / NO / 保留 で判定します。

性質の異なる 3 つの事例を収録しています。

| 事例 | 対象の性質 | 見どころ |
|---|---|---|
| [excel-macro/](excel-macro/) | **架空の Excel マクロ業務**(月次スケジュール登録。手順書起点・VBA 非開示) | 手運用ノードの可視化 / 回答メモによる 2 巡目実行 / 判定 YES の証拠化 |
| [tbm-template/](tbm-template/) | **実在のデータパイプライン**([suwa-sh/tbm-template](https://github.com/suwa-sh/tbm-template): dlt→PostgreSQL→dbt→Grafana) | SQL 本文を読まずに配賦ルール変更の影響を判定 / 「影響の有無は YES・範囲は未確定」という判定の分離 / 変更要望の曖昧さ(「共通費」とは?)を残質問へ変換 |
| [asana-register-routines/](asana-register-routines/) | **実在の小さな自動化ツール**([suwa-sh/asana-register-routines](https://github.com/suwa-sh/asana-register-routines): Google スプレッドシート + GAS) | 現場運用(設定シートの手作業)の業務フロー化 / 機能追加の届き先の見極め(最終境界への影響は未確定として保留) / README の記載漏れ検出 |

3 事例とも同じ手順・同じ出力フォーマットです。小さなツールから業務システム、データ基盤まで、
同じ 3 view で調査できることを示しています。

## 実行方法

各事例の README に、実行したコマンドと入力の所在を記載しています。基本形:

```
/distillery:dist-harvest --preflight <対象パス> --change "変更したい内容"
```

## output の生成手順(共通)

正式な出力先は実行プロジェクトの `docs/harvest/preflight/events/{event_id}/preflight.md`
(+ `latest/` への置換コピー)です。各事例の `output/preflight.md` は実行結果の手動コピーで、
event_id・実行日時・ローカルパスは実行のたびに変わります。再生成した場合は最新 event の
preflight.md を各事例の `output/` へコピーしてください。
