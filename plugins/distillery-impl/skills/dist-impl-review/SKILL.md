---
name: distillery-impl:dist-impl-review
description: >
  distillery-impl の実装レビュー資料生成スキル。UC実装の完了判断に必要な情報を、前提知識ゼロの
  読者が判断できる単一HTMLにまとめる。dist-impl-run(S9)から呼ばれ、プレビュー表示と
  承認・差し戻しの対話はオーケストレータが行う。
---

# dist-impl-review

引数: `uc_id={id} config={impl-config.yaml へのパス} manifest_sha256={オーケストレータ算出の global projection hash}`

`manifest_sha256` は再計算せず done に転記し、`manifest_projection: v2` を併記する
(state-schema.md の projection 規則)。

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
  （`attempt-*/S5_verify.*.findings.yaml` と、dispatchされたtierがあれば
  `attempt-*/S5_ui-review.*.findings.yaml` の両レーン）
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
4. **capture_reviewの画像を検証してから表示する**: `captures[]`の非skippedエントリごとに、
   story_screenshot/implementation_screenshotのpathがcanonical UC root内のcontainmentを満たし
   regular fileであること、ファイルが実在すること、実測SHA-256がfindings.yaml記載のsha256と
   一致することを検証する。**いずれかが不一致・欠落ならS9を完了しない**（S8以降で画像が
   置換・削除された可能性を示すため）。`captures_sha256`は、この検証を通過した実測値
   （`{path, sha256}`の配列）をcanonical JSON化して算出する（captureが無ければnull）
5. **captures[]の網羅性を検証する(fail-closed)**: `checks_checked.capture_review.status: done`の
   tierについては、対象UCのexecutable target集合をdist-impl-run/SKILL.mdの算出規則
   （story実体の存在・variants非空・矛盾3条件による除外）に従って独立に再計算し、
   `captures[].target`と1:1対応すること（欠落・重複・過剰なし）を確認する。さらに、
   capture_reviewのfindingごとに`0 <= capture_index < captures.length`かつ
   `captures[capture_index].result: diff`であることを確認する（範囲外・存在しない添字・
   match/skipped参照は不正）。**いずれか不一致ならS9を完了しない**（uc-map/design-eventの
   不整合、または改変・欠損の可能性を示すため）
6. HTML生成後のexact bytes SHA-256と、HTMLが表示する6ゲートの集約結果、open blocker件数、open major件数、
   手順4で算出した`captures_sha256`を`implementation_review_evidence`へ記録する。open blocker/major件数は
   S5 verifyとS5 ui-review（dispatchされたtierのみ）両レーンのfindingsを合算する。各値はS5〜S7 done
   とHTML表示をexact照合し、不一致ならS9を完了しない。**承認event生成前にもcurrent HTMLのSHAと
   captures[]の実測検証(手順4・5と同じ検証)を繰り返す**（承認直前の画像置換・欠損を検知するため）
7. `S9_review_generated.done.yaml` に共通スキーマと次を記録する

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
     captures_sha256: null
   ```

   draftがある場合は3値を実値にする。両evidence mappingを同じS9 `stage_completed` eventにもexact転記する。
   これはHTML生成の完了と、そのHTMLが示した実装結果・draft bytesの証拠であり、UC承認ではない。
   承認の正は、このS9 stage eventを参照し、両mappingをexactに持つ`review_approved` eventである
8. HTML path、全ゲートの結論、未解決finding件数、仕様起因要求件数、判断ポイントと
   `feedback_review_evidence` / `implementation_review_evidence`を返す

## 境界

- 本スキルはHTMLとS9 doneだけを書く
- `feedback/draft.md` を変更しない
- feedbackの公開、ID採番、immutable化は、実装承認後の `dist-impl-feedback mode=publish` が行う
- プレビュー表示とレビュー対話はdist-impl-runが行う
