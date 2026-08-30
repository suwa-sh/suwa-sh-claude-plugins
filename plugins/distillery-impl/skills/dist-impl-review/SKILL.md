---
name: distillery-impl:dist-impl-review
description: >
  distillery-impl の意思決定用レビュー資料生成スキル。UCの目的と対象仕様、実装構成、処理・
  データフロー、動かし方、テストを図解し、ユーザーに必要な承認・選択・回答方法を冒頭へ示す。
  未確定事項には推奨案と比較可能な選択肢を付け、前提知識のない読者が判断できる単一HTMLを作る。
---

# dist-impl-review

引数: `uc_id={id} config={impl-config.yamlへのpath} manifest_sha256={global projection hash}`

HTMLは認識合わせのための再生成可能な派生ビューであり、Git・仕様・実装・test・done・eventが正本である。
HTML bytes、画像bytes、HTMLの表示状態を承認証跡へ結ばない。

## 必須依存: diagram-design

図は必ず`diagram-design`で設計する。dist-impl-runの開始時確認に加え、本スキルも生成前に次を確認する。

- `~/.claude/skills/diagram-design/SKILL.md`
- `~/.agents/skills/diagram-design/SKILL.md`
- `.claude/skills/diagram-design/SKILL.md`

無い場合は生成を停止し、次を提示してインストールするか確認する。素のSVGへ自動fallbackしない。

> `diagram-design`スキルがインストールされていません。レビュー図の生成に必要です。
>
> - source: <https://github.com/cathrynlavery/diagram-design>
> - security audit: <https://skills.sh/cathrynlavery/diagram-design>
> - install: `npx skills add cathrynlavery/diagram-design`

存在する場合は`SKILL.md`、`references/style-guide.md`、選んだ図型の`references/type-*.md`を全文読む。
通常は次を使う。

| 表示する関係 | 図型 |
|---|---|
| componentと外部境界 | `type-architecture.md` |
| 判断・失敗分岐を含む処理 | `type-flowchart.md` |
| 技術的なdata topology | `type-architecture.md` |
| role別data pipeline | `type-data-flow.md` |
| entityと関係 | `type-er.md` |

## 情報設計

- 最初のviewportを「ユーザーにお願いしたいこと」にする
- 主役をUC、対象仕様、完成した実装、現在必要な人間判断に置く
- 作業履歴、attempt推移、内部stage code、finding IDを読者向け本文へ出さない
- 現在の問題だけを利用者・運用への影響とともに示す
- 取得できない値は「未確定」「未計測」「未検証」とする
- 件数は成功数/総数で表示する

### 人間に求める判断

判断を次の2種類へ分ける。

1. **実装承認**: 現在の成果を承認するか、差し戻すか
2. **仕様・運用の選択**: RDB、外部接続、保持、監査等、実装だけでは決められない事項
3. **前提の承認・却下**: 仕様に無いためImplementerが決めた判断（AssumptionRecord）を承認するか、
   却下するか。却下は `実装修正` か `仕様変更` を必ず添える。回答必須は「仕様に無い、かつ
   Implementer分類かVerifier分類が security / persistence」の前提だけ。他は未回答なら承認扱い

各判断は次を必ず持つ。

- 何を決めるかを1文の質問で示す
- 相互排他的な2〜3案を示す
- 最初の案を`推奨`とし、推奨理由、結果、主なtrade-offを示す
- 推奨が変わる条件を示す
- 選択後に人とagentが行うことを示す
- `機能=A / 相互運用=A / 監査=A`のようなcopy可能な回答templateを示す

すでに仕様・実装で確定した事項を選択肢へ戻さない。複数の未確定事項を1案へ束ねる場合は、
束に含まれる決定を明示し、個別選択したい利用者向けの案も用意する。

## 入力

`docs/impl/latest/{uc_id}/`のstatus、input manifest、current done/final findings、issues、
as-built summary、feedback draft、review notes、uc-map、current attemptの全tierの
`S4_tier-impl.{tier}.assumptions.yaml` とS5 findingsの `assumption_verdicts` を読む。manifest/configを起点に対象UCだけの
spec、tier spec、API/model summary、contract/architecture、implementation、tests、commandsを読む。
公開済みfeedback requestや無関係なUCを全走査しない。記録済みgateは再実行しない。

## 生成手順

1. 利用者、目的、trigger、事前条件、入力、出力、業務ルール、受け入れ条件、対象外を収集する。
2. component、外部境界、storage、正常系、重要分岐、失敗・timeout・補償、data source/transform/
   destination、秘密情報境界を実装と仕様から収集する。
3. 現在openの各問題を`承認を妨げる問題`、`承認後も選択が必要な問題`、`情報のみ`へ分類する。
4. `references/review-html-template.md`の順序で判断質問・推奨案・選択肢・回答templateを作る。
5. diagram-designのtaste gateを各図へ適用する。
   - connectorは先に描き、nodeを後から描く
   - off-axis接続はrounded orthogonal pathだけを使い、diagonalを禁止する
   - connectorの重なり、attach point共有、非endpoint node背面通過を禁止する
   - labelはmaskと6〜10pxのgapを持つ
   - 1図9node/12arrow以内、4px grid、図型に合うshapeを使う
   - `figure`、`figcaption`、`role="img"`、accessible name、文章のテキスト代替を付ける
6. `docs/impl/latest/{uc_id}/review/index.html`を自己完結HTMLとして生成する。
   - inline CSS/SVGのみ。external asset、font link、script、Mermaid runtimeを使わない
   - light/dark、390px/1440pxへ対応する
   - review HTML用のgitignore規則があることはorchestratorが保証する。HTMLをstage/commitしない
   - 各SVGを`data-diagram-type`で分類し、`<g data-layer="connectors">`を
     `<g data-layer="nodes">`より先に置く
   - 生成後に`node ${CLAUDE_PLUGIN_ROOT}/skills/dist-impl-review/scripts/validateReviewHtml.js
     docs/impl/latest/{uc_id}/review/index.html`を実行する。非0ならdoneを書かず図を修正する
   - validator通過後もrenderを目視し、connector重なり・共有attach point・node背面通過をtaste gateで確認する
7. feedback draftがあれば、各要求のhuman title、管理ID、severity、観測事実、問題、要求、完了条件を
   全文表示し、該当する判断質問と結ぶ。draftがなければ変更要求なしと示す。
7.5. 「実装者が補った前提」節を `references/review-html-template.md` の同名節に従って作る。
   回答必須の前提を先頭に集め、回答templateに `前提=` 行を含める。**全tierのAssumptionRecordが空、かつ全tierのS5 `assumption_verdicts` も空**の場合だけ
   「前提なし（Implementerは仕様外の判断をしていないと申告し、Verifierも未記載の判断を見つけていない）」と示す。
   記録が空でもVerifierが `V-nnn` を見つけていれば、それを前提一覧に載せる（回答必須になり得る）。
8. captureがある場合は生成時にpath containment、regular file、存在、記録SHAを確認してから表示する。
   HTML再生成や承認時にcapture/HTML SHAの再照合は行わない。
9. `S9_review_generated.done.yaml`へ次を記録する。HTML SHAとcapture SHAは記録しない。

```yaml
feedback_request_count: 0
open_blocker_count: 0
decision_summary:
  approval_questions: 1
  selection_questions: 0
  recommended_choices: 1
feedback_review_evidence:
  feedback_id: null
  draft_sha256: null
  request_count: 0
implementation_review_evidence:
  gate_result: "6/6 pass"
  open_blocker_count: 0
  open_major_count: 0
  assumption_evidence_sha256: "..."   # validateAssumptions.js evidence の出力。tier_id昇順に `{assumptions_sha256}:{assumption_verdicts_sha256}` を改行連結したsha256（state-schema.mdと同一式）
```

`decision_summary` には `assumption_questions`（回答必須の前提件数）も含める。
`assumption_evidence_sha256` は自分で連結せず、current attemptの全tierのS5 doneから
`node ${CLAUDE_PLUGIN_ROOT}/skills/dist-impl-implement/scripts/validateAssumptions.js evidence {tier}:{assumptions_sha256}:{assumption_verdicts_sha256} ...`
で算出する（承認・publish時の再計算と同じ実装を使う）。

feedback draftのidentity/bytesは公開する正本なので従来どおりexactに結ぶ。
`implementation_review_evidence`はgate、current finding集約、前提と判定のhash（canonical 4 field）だけを結び、HTML内容を結ばない。
旧done/eventに`review_html_sha256`や`captures_sha256`があっても承認時は無視する。

## 出力

HTML path、結論、ユーザーに求める判断一覧、推奨回答、確認結果、現在の未解決事項、
feedback/implementation evidenceを返す。

## 境界

- 本スキルはignored HTMLとS9 doneだけを書く
- feedback draft、仕様、実装、test、event、statusを変更しない
- HTMLをGitへadd/commitしない
- プレビュー表示、回答取得、event/status更新、feedback refresh/publishはdist-impl-runが行う
