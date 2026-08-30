---
name: distillery-impl:dist-impl-feedback
description: >
  実装で見つかった仕様起因の問題を、1つのfeedback-request Markdownへまとめる。
  S8はdraftを管理し、S9の承認後に同じbytesをimmutableな公開ファイルへ移す。
  実装時の学びと改善提案も保存する。
---

# dist-impl-feedback

```text
uc_id={id} config={impl-config.yaml} [mode=initial|refresh|publish] manifest_sha256={オーケストレータ算出の global projection hash} [supersedes={feedback_id}]
```

既定modeは`initial`です。
`supersedes`は公開済みfeedbackの訂正版を作る場合だけ指定します。
`manifest_sha256`は再計算せずdoneへ転記し、`manifest_projection: v2`を併記します
(state-schema.mdのprojection規則)。

| mode | 処理 |
|---|---|
| `initial` | issueを分類し、単一draftを作る |
| `refresh` | review notesを同じdraftへ反映する |
| `publish` | 承認済みdraftを同じbytesのまま公開する |

## 入力

- `docs/impl/latest/{uc_id}/issues/`
- `docs/impl/latest/{uc_id}/stages/attempt-*/S5_verify.*.findings.yaml`
- `docs/impl/latest/{uc_id}/stages/attempt-*/S5_ui-review.*.findings.yaml`（S5 並走の UI Reviewer。
  dispatchされたtierのみ存在）
- current attemptの `S4_tier-impl.*.assumptions.yaml`（AssumptionRecord）とS5 findingsの `assumption_verdicts`
- `review/review-notes.md` に記録された前提の却下（`spec_change` / `implementation_change` の種別つき）
- bootstrapとS1の矛盾または欠落
- `docs/impl/latest/{uc_id}/review/review-notes.md`（任意）

## draftの作成

### 1. 原因を分類する

| 分類 | 扱い |
|---|---|
| 仕様起因 | feedback requestへ含める |
| 実装起因 | 次のattemptで修正し、feedback requestへ含めない |
| 環境起因 | 実行環境の問題として記録し、feedback requestへ含めない |

分類理由と根拠pathは`feedback/as-built-summary.md`へ記録します。
実装済みのendpoint、状態遷移、header、error responseを、仕様どおり、不足、矛盾に分けます。
as-built summaryには **実装者が補った前提の一覧**（id、カテゴリ、前提、Verifierの判定、人の判断があればその決定と種別）も載せます。

前提の扱いは次のとおりです。仕様と矛盾する前提（contradicts）はblockerとしてS4で修正されるため、要求へ含めません。
人が `implementation_change` で却下した前提は実装起因としてS4で修正し、要求へ含めません。
**人が `spec_change` で却下した前提だけ**を、`severity: spec-gap` の要求候補にします（仕様に無いことを仕様で決めてほしい、という要求）。
このsummaryはdist-pipelineへの入力ではありません。

### 2. 1つのdraftへまとめる

書式は`references/feedback-request-authoring.md`に従います。
出力先は`docs/impl/latest/{uc_id}/feedback/draft.md`です。

- initialは`{YYYYMMDD_HHMMSS}_impl_feedback_{uc_id}`形式のfeedback IDを作る。
- refreshはfeedback ID、created_at、既存CR IDを維持する。
- 訂正版だけが新しいfeedback IDと`supersedes`を使う。
- 各CRは4つの必須節だけで理解できる内容にする。
- `related_ids`には安定した識別子を1件以上入れる。
- stage名、routing、stage別指示は書かない。
- review情報、承認者、入力hashはfront matterへ書かない。

有効な要求が0件ならdraftを作りません。
refreshで0件になった場合は、削除したCR IDをeventへ記録してから未公開draftを削除します。
公開済みファイルは削除しません。

### 3. 学びを保存する

再現できる実装上の学びは`learnings/{ts}_{slug}.md`へ保存します。
各ファイルは「何が起きたか」「原因」「回避方法」「次回の対応」の4節を持ちます。

一般化できる内容は次の提案ファイルへ保存します。

- `learnings/{ts}_proposal-skill.md`
- `learnings/{ts}_proposal-context.md`

既存のSKILL.md、CLAUDE.md、dev-rulesは直接変更しません。

### 4. S8の状態を更新する

`stages/S8_feedback.done.yaml`へ次を記録します。

```yaml
feedback_request:
  draft_path: "docs/impl/latest/{uc_id}/feedback/draft.md"
  request_count: 0
  blocker_count: 0
learnings: 0
proposals: {skill: false, context: false}
```

要求が0件なら`draft_path`を`null`にします。
refreshは`refreshed_at`と`updated / added / removed`も記録します。

## publish

publishは、承認されたdraftのidentityとbytesを変えずに公開する処理です。
承認情報を公開Markdownへ追加する処理ではありません。

### 1. 承認証跡を結ぶ

最新の`review_approved` eventが、最新のS9 review-generated eventを参照していることを確認します。
両eventの`feedback_review_evidence`をexact一致させます。

S9 done、S9 event、approval eventの`implementation_review_evidence`は、
`gate_result / open_blocker_count / open_major_count / assumption_evidence_sha256`のcanonical 4 fieldをexact一致させます。
`assumption_evidence_sha256`を持たない旧3 fieldだけのS9 evidence / approvalは、前提と判定を承認対象に
固定できていないため公開に使いません（S9を再生成して再レビューします）。
review HTMLはgitignoreされた補助資料なのでSHA-256を照合しません。旧eventの
`review_html_sha256`と`captures_sha256`はlegacy fieldとして比較から除外します。

event順はreview evidence、approval、publish started、publishedです。
current evidenceへ複数のapprovalがある場合は停止します。

使うapprovalは「最新」ではなく、state-schema.mdの「AssumptionRecord の完全性条件」をすべて満たす latest valid approvalです。
publish直前に、current attemptの全tierへ `validateAssumptions.js record` / `verdicts` を再実行し、
current S5 verdictsに対して `assumption_decisions` の完全性（1:1、必須回答、`rejected` は `spec_change` のみ）と
`assumption_evidence_sha256` の再計算一致を再検証します。満たさなければ公開せず、S9再生成へ戻します。

### 2. pathを検証する

draftと公開先は、安全なfeedback IDから導出したcanonical UC root内のpathだけを使います。
親componentは`lstat`と`realpath`で検証します。
親directoryとfileはsymlinkを許可しません。

draftは`regular file`かつ`non-symlink`でなければなりません。
公開先は未作成でなければなりません。
draftと公開先の親は`same-filesystem`でなければなりません。

### 3. draftを検証する

draftを`no-follow`で1回だけ開きます。
同じfile descriptorからbytesとSHA-256を取得します。

次の値を承認証跡とexact一致させます。

- feedback ID
- draft SHA-256
- request件数
- blocker件数

bytesはUTF-8、BOMなし、LF、NFCでなければなりません。
front matter、CR ID、必須節も検証します。
最終的な機械検証はdist-pipelineの`feedbackRequest.js`が担当します。

### 4. 公開する

rename前にdraftの`lstat`を再実行します。
検証時と`device/inode/size`が一致することを確認します。
親pathのcontainment、non-symlink、same-filesystemも再確認します。

先に`feedback_request_publish_started` eventを書きます。
eventはfeedback ID、path、input SHA-256、件数、review event IDを持ちます。

次に、draftを公開先へatomic renameします。
rename後のfileが同じdeviceとinodeを持つregular/non-symlink fileであることを確認します。
公開先をno-followで開き、SHA-256を再確認します。

最後に`feedback_request_published` eventを書きます。
S8 doneとstatusは公開path、identity、review event ID、published_atを参照します。

## 再開と訂正

同じfeedback versionのpublish started eventとpublished eventは各1件だけを許可します。
publish再開は、公開済みfileのpath、bytes、ID、件数、review lineageが一致するときだけno-opにします。
不一致時は上書きしません。

公開後の訂正では新しいfeedback IDを使います。
新しいdraftへ`supersedes`を記録し、S9の承認をやり直します。
旧fileと旧eventは保持します。

## 完了報告

initialとrefreshは、要求数、blocker数、learnings数、提案の有無、draft pathを報告します。
publishは公開path、feedback ID、要求数、SHA-256を報告します。

```text
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md
```

安全なroutingを自動採用する場合だけ`--recommended-auto`を付けます。
