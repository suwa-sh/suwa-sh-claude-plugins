# 実装レビューHTML骨格テンプレート（dist-impl-review）

単一HTML・逆ピラミッド構成。S9は実装の合否レビューであり、dist-pipelineのrouting reviewではない。

| # | セクション | 内容 | データ取得元 |
|---|---|---|---|
| 1 | 結論カード | UC名、評価対象、結論、根拠3点、次の行動 | status、done、findings |
| 2 | このUCは何か | 業務 / BUC / UC、実装tierと役割、主要な利用者価値 | uc-map、spec概要 |
| 3 | 6段ゲート結果 | ゲート名、意味、結果、分母つき件数、実施stage | doneのgates |
| 4 | Verifier反証と解決(両レーン) | attemptごとのblocker/major/minor、修正、再検証、未解決事項。verifyレーン（7観点）とui-reviewレーン（dom_snapshot/capture_review。dispatchされたtierのみ）を分けて示す | findings（S5_verify、S5_ui-review）、done |
| 5 | 実装と仕様の差分 | feedback ID / 件数 / path、各CRのID / severity / 観測事実 / 問題 / 要求 / 完了条件の全文、実装承認への影響 | as-built、feedback draft |
| 6 | 判断ポイント | 承認で確定する実装、承認後に公開されるfeedback、差し戻し先 | status、本文規則 |
| 7 | 技術詳細 | input manifest、model、attempt履歴、learnings | manifest、status、learnings |

## 結論バッジ

- **承認可能**: 全ゲートpassかつopen blocker 0
- **要修正**: ゲートfailまたは実装findingのopen blockerあり。戻り先stageを示す
- **仕様ブロック**: blocker severityの仕様要求が残る。実装の到達点と、仕様更新まで再開できない理由を示す

## UI一致確認の表示(ui-reviewレーン。セクション4)

dispatchされたtierがある場合、verifyレーンの反証と区別してui-reviewレーンの結果を表示する。
ui-reviewが1件もdispatchされていないtier・UCについては、一律「両方無効」表示で終わらせず、
理由を次の3分類のいずれかで明示し、未検証範囲が分かるようにする。

- **capability無効**: 該当tierの`tiers[].capabilities.ui_review`が`dom_snapshot: false`かつ
  `capture_review: disabled`（読解ベースの照合表のみで進めている）
- **screen解決0件**: uc-mapの`ui_screens`が0件で`ui_screen_resolution`が記録済み
  （`plain_ui_confirmed`/`feedback_requested`。素のpackages/uiで進める合意済みか変更要求起票済み）
- **executable target 0件**: capabilityは有効だが、story実体・variants未解決等でdispatch前提の
  target（screen×variant）がdist-impl-run側で算出できなかった（uc-map/design-eventの不整合の可能性）

いずれにも該当しない（capability有効かつtargetありでdispatchされている）場合は、通常どおり
checkごとの結果を表示する。

- **checkごとの対象数**: `checks_checked.{dom_snapshot,capture_review}.note`から「対象n画面×m状態」を転記する
- **checkごとの結果**: done/findingsから status（done/skipped/unverified）と、findings件数
  （severity別）を示す。`unverified`はdispatch前提と実態のずれを示すため、対象0件の理由を明示する。
  capture_reviewが`skipped`の場合は`reason`（`capability_disabled`＝方針で無効／
  `runtime_unavailable`＝browserツールがそのセッションで利用不能）を区別して示す
  （`runtime_unavailable`はdoneが`pass`のまま進む正常系であり、環境失敗ではない）
- **capture_reviewのキャプチャ表示**: findingsの`captures[]`から、targetごとに story側と実装側の
  スクリーンショットを**2枚並記**し、`observation`（所見）と`result`（match/diff/skipped）を添える。
  **リンクを生成する前に、path containment・regular file・存在・実測SHA-256の一致を検証済みの
  画像だけを表示する**（dist-impl-review/SKILL.mdの検証手順。未検証・不一致の画像は表示しない）。
  画像は`attempt-{n}/ui-artifacts/{tier_id}/`配下からHTMLの到達できる相対リンクで示し（sha256も併記し、
  改変されていないことを示す）、`result: skipped`（`reason: render_context_unavailable`）は画像を
  「再現不能」として明示し偽の一致・差分と誤読させない。差分がないtargetもS9では両画像を並記し、
  一致の根拠を確認できるようにする（アドホックレビューであり決定論のゲートではないことも明記する）
- **縮退状態（dom_snapshot側のみ）**: doneの`result: environment_failure`があれば、
  `environment_failure`フィールド（check/command/exit_code/evidence。失敗の一次根拠）、
  `degradation_proposed`の内容（capability更新案）、オーケストレータの縮退判断
  （承認/拒否、承認なら更新後のcapability値）を示す（capture_reviewはこの状態に到達しない —
  browserツール利用不能は上記`runtime_unavailable`スキップとして表示する）

## feedbackの表示

- feedback draftは実装中に判明した仕様差分の説明として表示する
- HTMLへ表示したdraftのexact bytesはS9 done/eventの`feedback_review_evidence`
  （feedback ID / SHA-256 / request件数）へ結ぶ。ただしhashやevent IDはHTMLへ表示しない
- feedback IDとrequest件数、review時の`feedback/draft.md`、承認後に同じbytesを置く
  `feedback-requests/{feedback_id}.md`を明示する。pathはHTMLから到達できる相対linkにする
- 各CRは観測事実 / 現在の仕様と問題 / 変更してほしいこと / 完了条件を全文表示する。認知負荷を下げる
  `details`折りたたみはよいが、link先を開かないと内容を承認できない構成にはしない
- pipeline内部の所有stage、stage別instruction、振り分け候補を作らない
- feedbackの承認を実装承認から分離した選択肢として出さない
- 実装承認後、有効要求が1件以上ならS8 publishが単一Markdownを公開することだけを説明する
- blockerの場合、承認は「現在の実装到達点を認め、仕様修正依頼を公開する」意味であり、UCは
  `blocked_on_spec`のままになる

## 判断ポイント

1. この実装を現在の仕様と明示した差分のもとで承認できるか
2. 未解決findingや暫定回避が利用者・運用へ与える影響を許容できるか
3. 差し戻す場合、どの実装stageから再実行すべきか

S9 done/eventはHTML exact bytes SHA-256、gate結果、open blocker/major件数、
`captures_sha256`（表示したcapture_reviewの全画像を束ねたsha256。captureが無ければnull）を
`implementation_review_evidence`へ記録する。captures_sha256はHTML生成後にスクショが
置換・欠損していないことの証跡であり、値自体はHTMLへ表示しない。承認時、オーケストレータはcurrent HTMLとこのmapping、
current draftと`feedback_review_evidence`が一致することを再検証し、そのS9 eventを参照して両mappingを
exactに持つ`review_approved` eventを記録する。承認後にfeedback draftがある場合、
S8 publishを実行してから終端状態へ進む。
公開されたMarkdownはdist-pipelineが自分でstage判定するため、レビュー時点でstage知識は不要。

## 様式規則

- セクション1だけで判断でき、後続は根拠の展開にする
- 数値は `n/分母`。欠測は「unknown」
- 色だけに意味を持たせない
- wide tableは横スクロール可能にする
- 外部asset、実行script、route JSON埋め込みを使わない
