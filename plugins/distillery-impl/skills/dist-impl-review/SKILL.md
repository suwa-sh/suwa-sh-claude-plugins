---
name: distillery-impl:dist-impl-review
description: >
  distillery-impl の実装レビュー資料生成スキル。UC実装の完了判断に必要な情報を、前提知識ゼロの
  読者が判断できる単一HTMLにまとめる。dist-impl-run(S9)から呼ばれ、プレビュー表示と
  承認・差し戻しの対話はオーケストレータが行う。
---

# dist-impl-review

引数: `uc_id={id} config={impl-config.yaml へのパス}`

S9は**実装のレビュー**である。dist-pipelineのstage割当てやrouteを決める場ではなく、feedback handoff用の
JSON、route file、approval hashは生成しない。一方、承認時に表示したfeedback draftと公開bytesを結ぶため、
内部のdone/event証跡にはdraftのidentityとSHA-256を記録する。この証跡は外部Markdownへ埋め込まない。

## 情報設計の原則

- 冒頭1画面で「何を評価したか / 結論 / 根拠 / 次の行動」が分かる
- 専門語（UC / tier / gherkin / ATDD等）は初出で1行説明する
- score・件数には分母と対象範囲を併記する
- 失敗・残課題は内部IDやraw dictではなく、読者が直せる言葉で書く
- 取得できなかった値は推測せず「unknown / 未計測」とする
- 仕様起因の残課題は実装承認への影響を示す。distillery内部stageの指定は示さない

## 入力

`docs/impl/latest/{uc_id}/` 配下の次を読む。

- `status.yaml`, `input-manifest.yaml`, `stages/` のdone・findings
- `issues/`, `feedback/as-built-summary.md`, 存在する場合は `feedback/draft.md`
- `learnings/`, `review/review-notes.md`
- `docs/impl/latest/uc-map.yaml` の対象UC

ゲート値はdoneから読み、再実行しない。公開済みfeedback-requestは実装レビューの入力にしない。

## 手順

1. `references/review-html-template.md` の構成で事実を収集する
2. `docs/impl/latest/{uc_id}/review/index.html` を生成する
   - `<meta charset="utf-8">`を先頭に置く
   - CSSをinlineにし、外部CDNへ依存しない
   - light/dark themeと狭幅表示に対応する
   - feedback draftがある場合はfeedback IDと件数、review時のcanonical draft path、承認後のimmutable公開予定pathを
     明示し、各CRのID、severity、タイトル、観測事実、問題、要求、完了条件を**全文**表示する。認知負荷を下げる
     ため各CRを`details`で折りたたんでよいが、HTML sourceに全節を含め、リンクだけに依存しない
   - pipeline内部の所有stage・振り分け・個別処理指示・承認hashは表示・埋め込みしない
   - draftがなければ「仕様への変更要求なし」を表示する
3. HTMLへ表示したdraftのexact bytesからSHA-256を計算する。front matterの`feedback_id`と、表示したCRの
   件数がS8 doneと一致することを確認する。draftがない場合はfeedback IDとSHA-256を`null`、
   request件数を`0`とする。不一致ならS9を完了せず、S8 refreshへ戻す
4. HTML生成後のexact bytes SHA-256と、HTMLが表示する6ゲートの集約結果、open blocker件数、open major件数を
   `implementation_review_evidence`へ記録する。各値はS5〜S7 doneとHTML表示をexact照合し、不一致ならS9を
   完了しない。承認event生成前にもcurrent HTMLのSHAを再検証する
5. `S9_review_generated.done.yaml` に共通スキーマと次を記録する

   ```yaml
   feedback_request_count: 0
   open_blocker_count: 0
   feedback_review_evidence:
     feedback_id: null
     draft_sha256: null
     request_count: 0
   implementation_review_evidence:
     review_html_sha256: "{sha256}"
     gate_result: "6/6 pass"
     open_blocker_count: 0
     open_major_count: 0
   ```

   draftがある場合は3値を実値にする。両evidence mappingを同じS9 `stage_completed` eventにもexact転記する。
   これはHTML生成の完了と、そのHTMLが示した実装結果・draft bytesの証拠であり、UC承認ではない。
   承認の正は、このS9 stage eventを参照し、両mappingをexactに持つ`review_approved` eventである
6. HTML path、全ゲートの結論、未解決finding件数、仕様起因要求件数、判断ポイントと
   `feedback_review_evidence` / `implementation_review_evidence`を返す

## 境界

- 本スキルはHTMLとS9 doneだけを書く
- `feedback/draft.md` を変更しない
- feedbackの公開、ID採番、immutable化は、実装承認後の `dist-impl-feedback mode=publish` が行う
- プレビュー表示とレビュー対話はdist-impl-runが行う
