# 実装レビューHTML骨格テンプレート（dist-impl-review）

HTMLは正本ではなく、ユーザーと認識を合わせて判断を受け取るための再生成可能な補助資料である。

## セクション構成

| # | 読者向け見出し | 必須内容 |
|---|---|---|
| 1 | ユーザーにお願いしたいこと | 判断質問、推奨案、選択肢、回答template |
| 2 | 判断サマリ | UCの目的、結論、blocker、未決定数 |
| 3 | UCとレビュー対象仕様 | actor、trigger、入出力、rule、受け入れ条件、対象外 |
| 4 | 決めてほしいことの詳細 | 各選択肢の結果、trade-off、推奨が変わる条件 |
| 4.5 | 実装者が補った前提 | 仕様に無いためImplementerが決めた判断の一覧。前提ごとにカテゴリ、前提、理由、Verifierの判定、影響箇所、回答要否。回答必須を先頭に集める |
| 5 | 実装の構成 | component、責務、外部境界、storageの構成図 |
| 6 | 処理フロー | 正常系、validation、失敗、timeout、補償のflowchart |
| 7 | データフロー | source、変換、保存、送信、秘密情報境界 |
| 8 | 動かし方 | runtime、設定、command、入出力、artifact、失敗の見方 |
| 9 | テストと確認方法 | 対象、command、成功数/総数、代表ケース、未確認範囲 |
| 10 | 判断後に起きること | 承認・差し戻し・各選択後の人/agentの行動 |
| 11 | 根拠と現在の制約 | current finding、feedback全文、source path |

この名称を見出しとして使い、内部stage codeへ置換しない。

## ユーザーにお願いしたいこと

最初のviewport内に、判断ごとのcardを置く。

```text
1. 機能を承認する
   A. 承認する（推奨）— 根拠と承認後の状態
   B. 差し戻す — 伝えてほしい再現条件と期待結果

2. 本番相互運用方式を選ぶ
   A. 推奨案 — 結果 / 理由 / trade-off
   B. 代替案 — 結果 / 向く条件 / trade-off
   C. 今回は保留 — 保留中にできること / できないこと

3. 実装者が補った前提を承認・却下する（回答必須: 仕様に無く security / persistence に関わるもの）
   A-001 時刻精度=秒 — 承認（推奨）/ 却下
   A-003 監査ログの保持期間=90日 — 却下（仕様変更: 保持期間を仕様で決める）

回答:
機能=A
相互運用=A
監査=A
前提=A-001:承認 / A-003:却下(仕様変更: 保持期間を仕様で決める) / V-001:却下(実装修正: 契約の canonical 順に合わせる)
補足=
```

前提の却下には必ず `実装修正` か `仕様変更` の種別を添える。`実装修正` は対象tierを再実装し、
`仕様変更` は変更要求（feedback）へ流れる。回答任意の前提は未回答なら承認扱い（auto_confirmed）になる。

card全体をclick可能に見せる偽UIや、動作しないradio/buttonを置かない。HTMLは静的資料であり、
回答はchatへcopyして返す形式にする。推奨には文字で`推奨`と表示し、色だけに頼らない。

## 選択肢の比較

各選択肢に次を示す。

| 観点 | 内容 |
|---|---|
| 選んだ後の状態 | component、運用、dataがどうなるか |
| 利点 | 目的に対する直接的な価値 |
| 主なtrade-off | cost、lock-in、migration、failure mode |
| 向く条件 | どの前提なら適切か |
| 可逆性 | 後で変える場合のcost |
| 次の行動 | 人とagentが直後に行うこと |

推奨案を最初に置く。推奨が逆転する条件を明記する。仕様不足を単に「要決定」とせず、
現行制約から導ける具体案を提示する。根拠がない製品versionや環境値は作らない。

## diagram-design適用

### 構成図

`type-architecture.md`を使う。primary flowの方向を固定し、zoneは最大3つ、nodeは9以下にする。
connectorはnodeより先に描く。複数edgeはattach pointを12px以上離してfan-outする。

### 処理フロー

`type-flowchart.md`を使う。start/endはoval、actionはrectangle、decisionはdiamondにする。
top-to-bottomを基本に、全分岐へlabelを付ける。

### データフロー

role-scoped pipelineなら`type-data-flow.md`、技術的topologyなら`type-architecture.md`、
entity関係なら`type-er.md`を使う。対象に合わない文法を混ぜない。

### connectorの合格条件

- diagonal line 0件
- off-axis pathはrounded orthogonalのみ
- shared attach point 0件
- overlapping segment 0件
- non-endpoint node背面通過0件
- label maskとconnectorのgap 6〜10px
- connectorを先、nodeを後に描画
- 4px grid、9node/12arrow以内
- diagram-design taste gateを完了

各SVGへ`data-diagram-type="architecture|flowchart|data-flow"`を付ける。矢印は
`<g data-layer="connectors">`、box/shape/textは`<g data-layer="nodes">`に置き、connector groupを先にする。
生成後は同梱の`validateReviewHtml.js`を必ず実行する。静的検査通過後にrenderを目視し、静的検査で
判定できないsegment重なり、attach point間隔、non-endpoint node背面通過、label gapを確認する。

## UC・操作・テスト

UC仕様は判断に必要な意味へ要約し、source pathへ追跡可能にする。
commandはactual entrypointから得る。秘密値は変数名だけを表示する。

テストは次のhuman nameで示し、`22/22件成功`のように分子/分母を持たせる。

- 書式確認
- 静的解析
- 実装層テスト
- 実装層の振る舞い確認
- UC統合テスト
- 受け入れテスト

正常系、validation、error、timeout、rollback/compensation、permission、秘密情報非包含、
test double境界と実systemで未確認の範囲を示す。

## 実装者が補った前提

- 入力は `attempt-{n}/S4_tier-impl.{tier}.assumptions.yaml`（全tier）と、S5 findingsの `assumption_verdicts`
- 前提ごとに カテゴリ（Implementer分類 / Verifier分類が違えば両方）、前提、理由、Verifierの判定
  （仕様に明示あり / 仕様に無い / 実装者が未記載のまま決めていた）、影響箇所、回答要否 を示す
- **回答必須**（仕様に無い、かつ どちらかの分類が security / persistence）を先頭に集め、`必須` と文字で示す
- Verifierが仕様との矛盾（blocker）と判定した前提はこの画面に到達しない（先に差し戻される）
- verdict名・finding ID・hashは本文へ出さない。前提IDは回答templateに必要なので表示する

## 現在の問題とfeedback

- 過去のfinding推移やattempt履歴を表示しない
- current blocker/majorだけを、影響と判断質問へ結ぶ
- feedback requestはhuman titleを主表示、管理IDを補助表示にする
- 観測事実、現在の仕様と問題、変更してほしいこと、完了条件を全文表示する
- pipeline route、stage ownership、approval hashを表示しない

## Git・証跡境界

- HTMLは`docs/impl/**/review/*.html`でgitignoreする
- HTMLのSHA、表示内容、capture SHAをdone/event/approvalへ記録しない
- HTMLを変更・再生成してもdone/event/statusの整合性を取り直さない
- feedback draftのID/SHA/件数、gate結果、current open finding件数は正本なので証跡へ残す
- HTMLが古い可能性は、画面上の生成時刻やsource revisionで利用者へ示す

## 様式

- 外部asset、script、font link、Mermaid runtimeを使わない
- CSSなしでも意味のあるreading orderを保つ
- 390pxと1440pxで利用可能にする
- 色だけで意味を示さない
- wide tableは横scroll可能にする
- hash/event ID/internal stage codeを読者向け本文へ出さない
