---
name: distillery-impl:dist-impl-review
description: >
  distillery-impl のレビュー資料生成スキル。UC 実装の完了判断に必要な情報を、前提知識ゼロの読者が
  合否判断できる単一 HTML(概要 → 6 段ゲート結果 → Verifier 反証と解決 → 残課題 → 判断ポイント)に
  まとめて docs/impl/latest/{uc_id}/review/index.html に出力する。
  dist-impl-run(S9)から呼ばれ、プレビュー表示と承認対話はオーケストレータが行う。
---

# dist-impl-review

引数: `uc_id={id} config={impl-config.yaml へのパス}`

## 情報設計の原則(ゼロ知識チェック)

- **冒頭 1 画面で「何を評価したか / 結論 / 根拠 / 次の行動」が分かる**こと
- 専門語(UC / tier / gherkin / ATDD 等)は初出で 1 行説明する
- score・件数には**分母と対象範囲**を併記する(例: 「シナリオ 8/8 pass(E2E 完了条件の全件)」)。
  部分集合の結果を全体評価に見せない
- 失敗・残課題は内部 ID や raw dict でなく、**読者が直せる言葉**で書く
- 取得できなかった値は推測で埋めず「unknown / 未計測」と明記する

## 入力(すべて docs/impl/latest/{uc_id}/ 配下)

status.yaml / input-manifest.yaml / stages/(done・findings)/ issues/ / change-requests/ / learnings/
と uc-map.yaml の該当行。ゲートの実測値は done ファイルの gates 記録から取る(再実行はしない)。

## 手順

1. `references/review-html-template.md` のセクション構成でデータを収集・整形する
2. 単一ファイル HTML を生成して `docs/impl/latest/{uc_id}/review/index.html` に書く:
   - `<meta charset="utf-8">` を必ず先頭に置く(欠くと日本語が文字化けする)
   - CSS はインライン。外部 CDN に依存しない(オフラインで開ける)。図は HTML/CSS で組む
   - ライト/ダーク両テーマ対応(prefers-color-scheme)
3. `S9_review_generated.done.yaml` を書く(**HTML 生成の完了であって UC の完了ではない**。
   UC 完了の正はユーザー承認の `review_approved` イベント)
4. 結果として「HTML のパス / 結論(全ゲート pass か / 残課題数)/ 承認判断のポイント」を返す

プレビュー表示(`open` / `xdg-open`)と承認・差し戻しの対話はオーケストレータの責務
(本スキルはファイル生成まで)。
