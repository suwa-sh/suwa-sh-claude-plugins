# 実装レビューHTML骨格テンプレート（dist-impl-review）

単一HTML・逆ピラミッド構成。主役はレビュー履歴ではなく、UC、対象仕様、完成した実装である。

## セクション構成

| # | セクション | 内容 | 主な根拠 |
|---|---|---|---|
| 1 | 判断サマリ | UC名、利用者価値、レビュー範囲、結論、根拠、次の行動 | UC仕様、現在の確認結果 |
| 2 | UCとレビュー対象仕様 | actor、trigger、事前条件、入力、出力、業務ルール、受け入れ条件、対象外 | spec、tier仕様、API/model summary |
| 3 | 実装の構成 | component、責務、外部system、storage、境界を構成図で示す | tier仕様、architecture、実装 |
| 4 | 処理フロー | 正常系と重要分岐・失敗時の流れを図示する | spec、実装、error contract |
| 5 | データフロー | dataのsource、変換、保存、送信、秘密情報境界を図示する | model、contract、実装 |
| 6 | 動かし方 | 前提、設定、command、代表入力、出力、artifact、失敗の見方 | impl-config、entrypoint、実装 |
| 7 | テストと確認方法 | 何を、どう実行し、何を確認したか。件数、代表ケース、障害注入、未確認範囲 | tests、done、最終findings |
| 8 | 現在の差分と制約 | 現在未解決のblocker/major、暫定境界、feedback全文 | 最終findings、as-built、draft |
| 9 | 判断ポイント | 承認で確定すること、許容する制約、差し戻し時に必要な情報 | 上記全体 |

この9名称をHTMLの見出しとしてそのまま使い、省略・内部コードへの置換をしない。

## 判断サマリ

- **承認可能**: 全確認結果がpassし、現在のopen blockerが0
- **要修正**: 確認結果にfail、または現在のopen blockerがある
- **仕様ブロック**: blocker severityの仕様要求が残り、現在の入力では実装を確定できない

冒頭には内部工程やattemptを出さず、次の4点だけを置く。

1. このUCが誰の何を実現するか
2. 今回どの仕様・実装境界をレビューするか
3. 合否と、その直接根拠
4. 「実装を承認」または「差し戻し」という次の行動

## UCとレビュー対象仕様

最低限、次を表または短いcardで示す。

- 利用者・起動主体
- triggerと事前条件
- 入力と入力元
- 成功時の出力・状態変化・artifact
- 失敗時の応答と残してはいけない状態
- 業務ルール・不変条件
- 受け入れ条件
- 今回の対象外または未確定境界

仕様文を丸ごと転載せず、判断に必要な意味へ要約する。各要約はpathまたは管理IDへ追跡可能にする。

## 3つの図解

外部runtimeなしで表示できるinline SVGまたはHTML/CSSを使う。Mermaid sourceだけを置かない。
各図は`figure`、見出し、`figcaption`、短いテキスト代替を持つ。色以外に形・線・ラベルで意味を示す。

### 構成図

次を左から右、または上から下へ配置する。

- actor / scheduler / browser等の起点
- 今回実装したcomponentを責務名で表示
- 関連する別component・外部system
- DB、queue、file、object storage等の永続境界
- network/process境界と、同期/非同期の別

`tier-facade`等の内部IDを箱名にせず、「起動受付CLI」等の責務名を使う。未確定の接続先は
破線と「未確定」と書き、推測で埋めない。

### 処理フロー図

番号付きnodeと矢印で、少なくとも次を示す。

1. triggerと入力受付
2. validationと業務ルール判定
3. 設定・data解決
4. 永続化またはartifact確定
5. 外部処理・下流呼出し
6. 成功応答
7. 重要な検証失敗・timeout・補償の分岐

正常系を主線、失敗系を分岐線にする。実装が保証する順序と、仕様上未確定の順序を区別する。

### データフロー図

data objectごとにsource→transform→destinationを示す。

- user/scheduler入力
- config・job map・feature flag
- request/command DTO
- domain/state record
- execution artifact・event・log
- DB/queue/file/remoteへの保存・送信
- response/stdout/stderr
- secretそのものとcredential referenceの境界

矢印にはdata名またはformatを付ける。保存は円筒、processは角丸、外部actorは別形状など、凡例を付ける。

## 動かし方

copyできる形で次を示す。

- 必要なruntime・tool・接続先
- 必須環境変数やconfig。秘密値は名前だけで値を載せない
- 最小command例
- 代表入力例
- 成功時のexit code / HTTP status / stdout / response
- 失敗時の観測点
- 生成artifact、DB record、logの場所
- cleanupや再実行時の注意

commandはactual entrypointから得る。仕様だけを根拠に、実装に存在しないcommandを作らない。

## テストと確認方法

レビュー履歴ではなく、現在の実装に対する確認範囲を示す。

| 表示名 | 説明 |
|---|---|
| 書式確認 | formatterのcheck-only結果 |
| 静的解析 | lint / typecheck / schema validation |
| 実装層テスト | unit・component・境界・障害注入 |
| 実装層の振る舞い確認 | tier単位のBDD |
| UC統合テスト | 全componentを結んだUC BDD |
| 受け入れテスト | 選択されたATDD |

各行に、対象、実行方法、成功数/総数、代表ケースを示す。`22/22件成功`のように分子と分母を明記し、
`22 tests`のような総数だけの合格表現を使わない。command全文はcopy可能な`details`へ置いてよい。
特に次を明示する。

- 正常系で何をassertしたか
- validation/error/timeout/rollback/compensationをどう注入したか
- file/DB/message/remote/UIをどう観測したか
- 実時間、permission、秘密情報非包含等の非機能確認
- mock/test doubleを使った境界と、実systemで未確認の範囲

### UIがある場合

UI reviewはattempt履歴ではなく「見た目と構造の確認方法」として本節へ統合する。

- DOM一致とcapture reviewの対象数・結果を示す
- captureはpath containment、regular file、存在、実測SHA-256一致を検証した画像だけを表示する
- targetごとにstory側と実装側を並べ、observationとmatch/diff/skippedを示す
- `render_context_unavailable`は「再現不能」と明記し、一致扱いにしない
- capability無効、screen解決0件、executable target 0件は、人間向けの理由と未確認範囲を示す

## 現在の差分とfeedback

- 過去のfinding件数推移や、どのattemptで何を直したかは表示しない
- 現在openのblocker/majorだけを、影響、暫定回避、承認判断への意味とともに示す
- 閉鎖済みfindingは、現在のテスト説明に必要な場合だけ「確認済みの性質」として示し、履歴を語らない
- feedback draftがあれば、feedback ID、要求数、review時path、承認後公開予定pathを示す
- 各CRは観測事実、現在の仕様と問題、変更してほしいこと、完了条件を全文表示する
- CR IDより人間向けタイトルを先に表示する
- pipeline内部のstage、routing、個別処理指示、承認hashを表示しない

## 内部コードを読者向け名称へ変換する

HTML本文・見出しでは次のように表現する。

| 内部コード | 読者向け名称 |
|---|---|
| S1 | 仕様入力の確認 |
| S2 | テスト足場の準備 |
| S3 | 契約の整合確認 |
| S4 | 実装層の実装・テスト |
| S5 | 独立検証 |
| S6 | UC統合テスト |
| S7 | 受け入れテスト |
| S8 | 仕様差分の整理 |
| S9 | 人レビュー |

原則として内部コード自体を併記しない。raw statusは「実行中」「レビュー待ち」「完了」等へ変換する。
tier IDはtier仕様の責務名へ変換する。管理IDが追跡に不可欠な場合だけ、主表示の後に小さく添える。

## evidence

S9 done/eventはHTML exact bytes SHA-256、`6/6 pass`等の集約結果、現在のopen blocker/major件数、
`captures_sha256`を`implementation_review_evidence`へ記録する。feedback draftのID・SHA・件数は
`feedback_review_evidence`へ記録する。これらのhashやevent IDはHTMLへ表示しない。

承認時、オーケストレータはcurrent HTML・draft・captureを再検証し、S9 evidenceと一致する場合だけ
`review_approved` eventを作る。承認後にdraftがあれば、同じbytesをimmutable feedback requestへ公開する。

## 様式規則

- 文章だけで3項目以上の関係を説明しない。対応表、flow、図へ変換する
- 1図はおおむね9 node以内。複雑なら分割する
- 図中の文字は狭幅でも読める大きさにし、横スクロールまたはresponsive viewBoxを使う
- 数値は`n/分母`。欠測は「未計測」
- 色だけに意味を持たせない
- wide tableは横スクロール可能にする
- 外部asset、実行script、route JSON埋め込みを使わない
