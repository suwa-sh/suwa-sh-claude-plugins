# preflight 事例: asana-register-routines(小さな自動化ツール)

実在の公開リポジトリ [suwa-sh/asana-register-routines](https://github.com/suwa-sh/asana-register-routines)
(Asana へ定期タスクを登録する Google スプレッドシート + GAS スクリプト)への実機実行例です。

## シナリオ

機能追加の要望「マスターデータ一括同期に、タグ一覧に加えてカスタムフィールド一覧の同期を追加したい」の
影響範囲を、**GAS スクリプト(src/*.gs)の本文を読まずに**調査します。証拠は README・CLAUDE.md・
設定ファイル(.clasp.json / appsscript.json)・ログの冒頭だけです。

## 実行コマンド

```
/distillery:dist-harvest --preflight <asana-register-routines のローカルパス> --change "マスターデータ一括同期に、タグ一覧に加えてカスタムフィールド一覧の同期を追加したい"
```

- 実行時の対象 revision: `733394c`(2026-08-13 時点の main)
- 入力はリポジトリそのもの(このディレクトリには含めず、GitHub を参照してください)

## 結果の見どころ([output/preflight.md](output/preflight.md))

- **機能追加の「届き先」の見極め**: 変更が直接届くのはスプレッドシートのマスターシートとプルダウン候補。
  最終境界(Asana に作られるタスクの内容)まで届くかは**用途次第として未確定**に分類され、
  「プルダウン提供までか、タスク登録時の設定までか」が最初の質問になる
- **現場運用の業務フロー化**: PAT の手入力・workspace の手動選択・3 手順の順序遵守といった
  設定シートの手作業が、手運用ノードとして「なぜ残っているか」つきで可視化される
- **ついでの発見**: README の機能説明と実行フローの不一致(`syncWorkspaces` の記載漏れ)を検出
- **無関係ファイルの排除**: `logs/` が別プロダクトのログ(実出力ではない)だと根拠つきで読む範囲から除外される
