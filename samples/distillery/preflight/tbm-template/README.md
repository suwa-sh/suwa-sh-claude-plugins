# preflight 事例: tbm-template(データパイプライン)

実在の公開リポジトリ [suwa-sh/tbm-template](https://github.com/suwa-sh/tbm-template)
(TBM = Technology Business Management を小さく始めるテンプレート。dlt → PostgreSQL → dbt → Grafana)
への実機実行例です。

## シナリオ

TBM 運用の典型的な変更要望「共通費の配賦ルールを人数比からコスト比に変更したい」の影響範囲を、
**dbt モデルの SQL 本文を 1 行も読まずに**調査します。証拠は README・memory-bank・
Agent Skills ドキュメント・シード CSV(実データ)・設定ファイル名だけです。

## 実行コマンド

```
/distillery:dist-harvest --preflight <tbm-template のローカルパス> --change "共通費の配賦ルールを人数比からコスト比に変更したい"
```

- 実行時の対象 revision: `d25f982`(2026-08-13 時点の main)
- 入力はリポジトリそのもの(このディレクトリには含めず、GitHub を参照してください)

## 結果の見どころ([output/preflight.md](output/preflight.md))

- **影響の「有無」と「範囲」の分離**: 判定は YES で確定(配賦値が変われば Grafana の金額・比率が変わる)
  しつつ、「共通費」がモデルのどの要素かが一意に定まらないため**範囲は未確定**として残質問へ
- **変更要望の曖昧さの検出**: 「共通費とは?」「コスト比の分母は?」「静的 CSV 更新か動的算出か?」
  「循環参照をどう解くか?」— 実装前に決めるべき論点が質問リストに変換される
- **読む範囲の絞り込み**: 全 dbt モデルでなく、シード CSV + 配賦 core モデル + テストに限定される
