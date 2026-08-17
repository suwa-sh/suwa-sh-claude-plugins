---
name: distillery-impl:dist-impl-review
description: >
  distillery-impl の実装レビュー資料生成スキル。UCの目的と対象仕様、実装構成、処理フロー、
  データフロー、動かし方、テストと確認方法を静的図解付きの単一HTMLへまとめ、前提知識のない
  読者が実装を承認または差し戻しできるようにする。dist-impl-run(S9)から呼ばれ、
  プレビュー表示と承認対話はオーケストレータが行う。
---

# dist-impl-review

引数: `uc_id={id} config={impl-config.yaml へのパス} manifest_sha256={オーケストレータ算出の global projection hash}`

`manifest_sha256` は再計算せず done に転記し、`manifest_projection: v2` を併記する
(state-schema.md の projection 規則)。

S9は実装の合否レビューである。dist-pipelineのstage割当てやrouteを決める場ではない。
feedback handoff用JSON、route file、approval hashは生成しない。一方、承認時に表示したfeedback draftと
公開bytesを結ぶため、内部のdone/event証跡にはdraft identityとSHA-256を記録する。
これらの内部証跡はHTMLへ表示しない。

## 情報設計の原則

- 主役を「UCそのもの」「レビュー対象の仕様」「完成した実装」に置く
- 冒頭1画面で「何を実現するUCか / 何を確認したか / 結論 / 次の行動」を示す
- 仕様、構成、処理、データ、操作、テストの順に、判断へ必要な事実を展開する
- 構成・処理・データの関係は静的図解し、文章の読み合わせだけにしない
- レビュー指摘の推移、attemptごとの件数、修正履歴はHTMLへ表示しない
- 現在未解決の問題だけを、利用者・運用への影響とともに示す
- 取得できない値は推測せず「未確定」「未計測」と明示する
- score・件数には分母と対象範囲を付ける

## 読者向け名称

HTMLでは内部コードより意味の分かる名称を使う。

- `S1`〜`S9`、`attempt-*`、raw status、finding IDを見出しや説明の主語にしない
- 必要な工程名は「仕様入力の確認」「実装層のテスト」「独立検証」「UC統合テスト」
  「受け入れテスト」「仕様差分の整理」「人レビュー」のように書く
- `tier-*`はtier仕様から責務名を作り、「起動受付CLI」「業務API」「非同期ワーカー」のように示す
- `format` / `lint` は「書式確認」/「静的解析」のように日本語名を主表示にする
- UC ID、CR ID、file path、command等のコード値が必要な場合は、人間向け名称を先に示し、
  補助的な管理情報またはcopy可能なcodeとしてだけ添える

## 入力

`docs/impl/latest/{uc_id}/` 配下から次を読む。

- `status.yaml`, `input-manifest.yaml`, 現在有効な `stages/` done・最終findings
- `issues/`, `feedback/as-built-summary.md`, 存在する場合は `feedback/draft.md`
- `learnings/`, `review/review-notes.md`
- `docs/impl/latest/uc-map.yaml` の対象UC

さらに、`input-manifest.yaml` と `impl-config.yaml` を起点に、対象UCだけの次を読む。

- UC仕様、tier仕様、API/model summary、関連contract・architecture
- 実装されたentrypoint/moduleと、そのUCのtier test・UC BDD・選択ATDD
- 実行command、必要な設定・環境変数、生成artifact・永続化先

無関係なUCやtierを全走査しない。ゲート値はdoneから読み、レビュー生成時に再実行しない。
公開済みfeedback-requestは入力にしない。

## 手順

1. `references/review-html-template.md` に従い、次の事実を仕様と実装から収集する。
   - 利用者、目的、trigger、事前条件、入力、出力、業務ルール、受け入れ条件、対象外
   - componentと外部境界、責務、同期/非同期、storage/artifact
   - 正常系、主要分岐、検証失敗、外部I/O失敗の処理順
   - 各データのsource、変換、保存、送信、秘密情報の境界
   - 実行方法、必要設定、代表例、成功/失敗の観測方法
   - テスト対象、テスト方法、障害注入、確認結果、未確認範囲
2. 収集した各主張を、仕様path・実装path・test/doneのいずれかへ結び、推測を混ぜない。
3. `docs/impl/latest/{uc_id}/review/index.html` を生成する。
   - templateの9セクション名を、そのまま読者向け見出しとしてすべて表示する
   - `<meta charset="utf-8">`を先頭に置く
   - CSSをinlineにし、外部CDN・外部scriptへ依存しない
   - light/dark themeと狭幅表示に対応する
   - 構成図、処理フロー図、データフロー図を生成する。inline SVGまたはHTML/CSSだけを使い、
     Mermaid runtimeや画像生成サービスに依存しない
   - 各図を`figure`と`figcaption`で囲み、図だけに依存しない短いテキスト代替を併記する
   - 色だけで状態を区別せず、箱・線・ラベル・凡例を使う
   - nodeが多い場合は図を分け、1図をおおむね9 node以内に保つ
   - feedback draftがある場合はfeedback IDと件数、review時path、承認後の公開予定path、
     各CRのseverity、タイトル、観測事実、問題、要求、完了条件を全文表示する
   - pipeline内部のstage code、routing、個別処理指示、承認hashは表示・埋め込みしない
   - draftがなければ「仕様への変更要求なし」と表示する
   - テスト件数は`22/22件成功`のように成功数/総数を表示し、総数だけを合格表現にしない
4. HTMLへ表示したdraftのexact bytesからSHA-256を計算する。front matterのfeedback IDと、
   表示したCR件数がS8 doneと一致することを確認する。draftがない場合はfeedback IDとSHA-256を
   `null`、request件数を`0`とする。不一致ならS9を完了せずS8 refreshへ戻す。
5. capture_reviewがある場合は、非skipped画像ごとにcanonical UC root内のcontainment、regular file、
   存在、実測SHA-256とfindings記載値の一致を確認してから、テストと確認方法の節に表示する。
   不一致・欠落ならS9を完了しない。`captures_sha256`は検証済み実測値のcanonical JSONから算出し、
   captureがなければ`null`とする。
6. `checks_checked.capture_review.status: done`のtierでは、executable target集合を独立再計算し、
   `captures[].target`と1:1対応することを確認する。capture findingは有効範囲の`capture_index`を持ち、
   参照先が`result: diff`でなければならない。不一致ならS9を完了しない。
7. HTML生成後のexact bytes SHA-256と、HTMLに表示した6種類の確認結果、現在のopen blocker/major件数、
   `captures_sha256`を`implementation_review_evidence`へ記録する。open件数は現在有効な最終findingsを
   verify/ui-review両レーンで合算する。HTML表示とdoneが一致しなければS9を完了しない。
   承認event生成前にもcurrent HTMLとcaptureを再検証する。
8. `S9_review_generated.done.yaml` に共通スキーマと次を記録する。

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

   draftがあれば3値を実値にする。両evidence mappingをS9 `stage_completed` eventにもexact転記する。
   done/eventはHTML生成の証跡であり、UC承認ではない。承認の正は、同じevidenceを持つ
   `review_approved` eventである。
9. HTML path、結論、確認結果、現在の未解決事項、仕様変更要求、判断ポイント、両evidence mappingを返す。

## 境界

- 本スキルはHTMLとS9 doneだけを書く
- `feedback/draft.md`を変更しない
- feedbackの公開、ID採番、immutable化は承認後の`dist-impl-feedback mode=publish`が行う
- プレビュー表示とレビュー対話はdist-impl-runが行う
