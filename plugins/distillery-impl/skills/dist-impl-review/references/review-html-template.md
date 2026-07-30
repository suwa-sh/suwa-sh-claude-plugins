# 実装レビューHTML骨格テンプレート（dist-impl-review）

単一HTML・逆ピラミッド構成。S9は実装の合否レビューであり、dist-pipelineのrouting reviewではない。

| # | セクション | 内容 | データ取得元 |
|---|---|---|---|
| 1 | 結論カード | UC名、評価対象、結論、根拠3点、次の行動 | status、done、findings |
| 2 | このUCは何か | 業務 / BUC / UC、実装tierと役割、主要な利用者価値 | uc-map、spec概要 |
| 3 | 6段ゲート結果 | ゲート名、意味、結果、分母つき件数、実施stage | doneのgates |
| 4 | Verifier反証と解決 | attemptごとのblocker/major/minor、修正、再検証、未解決事項 | findings、done |
| 5 | 実装と仕様の差分 | feedback ID / 件数 / path、各CRのID / severity / 観測事実 / 問題 / 要求 / 完了条件の全文、実装承認への影響 | as-built、feedback draft |
| 6 | 判断ポイント | 承認で確定する実装、承認後に公開されるfeedback、差し戻し先 | status、本文規則 |
| 7 | 技術詳細 | input manifest、model、attempt履歴、learnings | manifest、status、learnings |

## 結論バッジ

- **承認可能**: 全ゲートpassかつopen blocker 0
- **要修正**: ゲートfailまたは実装findingのopen blockerあり。戻り先stageを示す
- **仕様ブロック**: blocker severityの仕様要求が残る。実装の到達点と、仕様更新まで再開できない理由を示す

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

S9 done/eventはHTML exact bytes SHA-256、gate結果、open blocker/major件数を
`implementation_review_evidence`へ記録する。承認時、オーケストレータはcurrent HTMLとこのmapping、
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
