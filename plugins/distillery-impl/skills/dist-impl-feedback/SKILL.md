---
name: distillery-impl:dist-impl-feedback
description: >
  distillery-impl の還流スキル。実装で見つかった仕様起因の問題を、dist-pipeline が直接受け取る
  単一の feedback-request Markdown にまとめる。S8 initial/refresh ではレビュー前の draft を管理し、
  S9 の実装承認後に publish で同じ bytes を immutable な公開ファイルへ移す。
  ハマりどころは learnings、skill・プロジェクトコンテキストへの改善は提案として保存する。
---

# dist-impl-feedback

引数: `uc_id={id} config={impl-config.yaml へのパス} [mode=initial|refresh|publish] [supersedes={feedback_id}]`
（既定 `initial`。`supersedes`は公開後の訂正版をinitialで作る場合だけ指定）

- `mode=initial` — issues / findings を分類し、仕様起因の要求をすべて含む単一
  `feedback/draft.md` と `feedback/as-built-summary.md` を作る。既存 draft があれば同じ
  `feedback_id` と CR ID を維持して更新する。`supersedes`指定時は旧公開fileを変更せず、新IDのdraftを作る
- `mode=refresh` — `review/review-notes.md` の指摘を反映し、同じ draft 内の要求を更新・追加・除去する。
  除去した CR ID は event payload と review notes に残し、公開対象からは外す
- `mode=publish` — **S9 の `review_approved` event が存在し、そのeventが参照するS9 review evidenceと
  approvalの`implementation_review_evidence`、draftのidentity/hash/countが一致する場合だけ**実行する。draft を検証し、
  同じ bytes のまま `feedback-requests/{feedback_id}.md` へ原子的に rename する。公開後のファイルは
  編集しない。これは実装承認を入力内容へ埋め込む処理ではなく、レビュー済み実装で残った仕様課題を
  immutable な handoff として公開する処理である

## 入力

- `docs/impl/latest/{uc_id}/issues/`（Implementer / integration writer の仕様疑義）
- `docs/impl/latest/{uc_id}/stages/attempt-*/S5_verify.*.findings.yaml`
- bootstrap / S1 の報告に含まれた矛盾・欠落
- `docs/impl/latest/{uc_id}/review/review-notes.md`（存在する場合）

## initial / refresh

### 1. 原因を分類する

すべての issue / finding を次に分類する。

1. **仕様起因**: 仕様の誤り・欠落・矛盾。feedback request に含める
2. **実装起因**: 実装で解決済み、または次 attempt で直す。feedback request に含めない
3. **環境起因**: ツール・依存・実行環境の問題。feedback request に含めない

分類理由と根拠パスを `feedback/as-built-summary.md` に記録する。変更要求を書く前に、実装が実際に
満たすエンドポイント、状態遷移、ヘッダ契約、エラー応答を「仕様どおり / 仕様にない追加 / 仕様と矛盾」
で整理する。これは handoff 入力ではない。

### 2. 単一 draft を作る

`references/feedback-request-format.md` に従い、仕様起因の全要求を
`docs/impl/latest/{uc_id}/feedback/draft.md` の1ファイルへまとめる。

- initialで`date`から`{YYYYMMDD_HHMMSS}_impl_feedback_{uc_id}`を採番し、同じ時刻を`created_at`へ
  記録する。refreshでは両方を変えない。公開後の訂正だけが新IDと`supersedes`を使う
- pipeline内部のstage名・振り分け・stage別処理指示は書かない。所有stageの判定はdist-pipelineの責務
- `CR-{uc_id}-{3桁連番}` をinitialで採番し、意味が同じ要求はrefreshでもIDを変えない
- 各要求は、観測した事実 / 現在の仕様と問題 / 変更してほしいこと / 完了条件だけで自己完結させる
- `related_ids`には最低1つの安定した要件・仕様・契約識別子を入れる。根拠を識別できない要求は公開しない
- `related_files` はルーティングのヒントにすぎない。本文だけで要求を判断できるようにする
- draft には有効な要求だけを置く。0件ならdraftを作らない。refreshで0件になった場合は、0件と除去IDを
  eventへ記録してから、正確な未公開`feedback/draft.md`だけを削除する。公開済みfileは削除しない
- front matter にレビュー情報、承認者、stage enum、元ファイルhashを入れない

### 3. learnings と改善提案を保存する

実装中の再現可能なハマりどころを `learnings/{ts}_{slug}.md` に1件1ファイルで保存する。
形式は「何が起きたか / なぜ / どう回避したか / 次回どうすべきか」の4節。

一般化できる学びは次の提案ファイルにする。既存のSKILL.md、CLAUDE.md、dev-rulesは編集しない。

- `learnings/{ts}_proposal-skill.md`
- `learnings/{ts}_proposal-context.md`

### 4. S8 done を記録する

`stages/S8_feedback.done.yaml` に共通スキーマと次を記録する。

```yaml
feedback_request:
  draft_path: "docs/impl/latest/{uc_id}/feedback/draft.md" # 0件なら null
  request_count: 0
  blocker_count: 0
learnings: 0
proposals: {skill: false, context: false}
```

refreshでは `refreshed_at` と `updated / added / removed` を追加する。

## publish

1. latest events を読み、対象UCに有効な `review_approved` があること、そのpayloadの
   `review_evidence_event_id`が実在する最新のS9 review-generated stage eventを参照すること、両eventの
   `feedback_review_evidence`（feedback_id / draft_sha256 / request_count）がexact一致することを確認する。
   S9 done / S9 event / approval eventの`implementation_review_evidence`（review HTML SHA-256 / gate結果 /
   open blocker件数 / open major件数）もexact一致し、approval直前のreview HTML exact bytesとも一致することを
   確認する。
   review evidenceよりapprovalのevent IDが後であり、当該evidenceを参照するapprovalが一意であることも
   確認する。旧review cycleのapprovalは履歴として無視し、current evidenceへの重複・競合は停止する。
   eventのpayloadをfeedback本文やfront matterへ転記しない
2. UC rootから固定導出したdraftと公開先の各pathについて、既存の全親componentを`lstat`し、directoryかつ
   symlinkでないこと、`realpath`がcanonical UC root配下に留まることを確認する。draft本体は`lstat`で
   regular fileかつnon-symlink、公開先は未存在、公開先親directoryはdraftと同じfilesystem deviceでなければ
   停止する。安全なfeedback IDから導出したcanonical path以外や、symlink経由の別pathを受け入れない
3. draftをno-followで一度だけ開き、同じfile descriptorからUTF-8 BOMなし / LF / NFC / strict front matter /
   CR ID一意性 / 必須節 /
   空本文なしを自己検査する。producer側に別schema/parserや曖昧なcross-plugin script pathは持たない。
   契約の機械検証正本とfail-closedな最終検証はdist-pipelineの`feedbackRequest.js`が担う
4. front matterの `feedback_id` が安全なIDで、`uc_id`が8文字またはuc-map衝突延長時の12文字であり、
   引数およびcurrent uc-mapのIDとexact一致することを確認する
5. draftのexact bytes SHA-256、feedback ID、request件数が承認済み`feedback_review_evidence`と一致することを
   確認し、同じopened bytesからblocker件数も再計算する。S8 doneの件数を信頼せず、以後のeventと終端stateには
   この再計算値だけを使う。不一致なら公開せず、S8 refresh → S9 HTML再生成 → 再レビューを要求する
6. `feedback-requests/{feedback_id}.md` が既に存在したら、publish started eventに基づく再開の場合を除き、
   同一内容でも上書きせず停止する
7. `feedback_request_publish_started` eventへ `feedback_id / path / input_sha256 / request_count /
   blocker_count / supersedes / review_approved_event_id / review_evidence_event_id` を記録する。
   `input_sha256`は承認済み`draft_sha256`と同値でなければならない。これをdraft移動前の再開点にする
8. rename直前にdraftの`lstat`を再実行し、検証時とdevice/inode/sizeが同一でregular/non-symlink、公開先が
   依然未存在、両親のrealpath containmentとsame-filesystemが維持されていることを確認してatomic renameする。
   rename後は公開先を`lstat`し、同じdevice/inodeのregular/non-symlinkであることを確認する。これにより
   変換・再読込・二重正本・symlink差し替えを作らず、検証済みbytesそのものを公開する
9. 公開先をno-followで開いてhash検証し、`feedback_request_published` eventへ同じidentity、2つのreview event ID、
   `published_at`を記録する
10. `S8_feedback.done.yaml` の `feedback_request` を `draft_path: null` とし、`published_path`、
   `feedback_id`、`input_sha256`、`review_approved_event_id`、`review_evidence_event_id`、`published_at`を追記する

有効要求が0件ならファイルを公開せず、`mode=publish`は `published: false, reason: no_requests` を返す。
同じfeedback versionについてpublish started/published eventは各1件だけを許し、event ID順は
review evidence < approval < publish started < publishedとする。既存published eventを見つけた再開は、
canonical公開pathの親component containment、regular/non-symlink、exact bytes SHA、feedback ID、request件数、
review lineageがすべて一致するときだけno-opにする。不一致や別pathは上書き・再publishせず停止する。

### 公開後の訂正

公開ファイルは、dist-pipeline未実行でも編集しない。訂正する場合は新しいdraftを作り、次を守る。

- 新しい `feedback_id` を採番する
- front matterの `supersedes` に旧feedback IDを書く
- 新しいS9実装レビュー承認を経てpublishする
- 旧公開ファイルと旧eventを残す

## 完了報告

- initial/refresh: 有効要求N件（blocker M件）、learnings件数、提案の有無、draftパス
- publish: 公開パス、feedback ID、request件数、SHA-256と次のコマンド

```text
/distillery:dist-pipeline docs/impl/latest/{uc_id}/feedback-requests/{feedback_id}.md
```

自動推奨ルーティングを使う場合だけ末尾に `--recommended-auto` を付ける。どちらの場合も
dist-implはstageを指定しない。
