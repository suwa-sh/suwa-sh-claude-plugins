---
name: distillery-impl:dist-impl-run
description: >
  distillery-impl のオーケストレータ。UC を指定して実装パイプライン(S0 bootstrap → S1 uc-init →
  S2 test-scaffold → S3 contracts → S4 tier 並走実装 → S5 別モデル Verifier → S6 UC BDD → S7 ATDD →
  S8 feedback → S9 review)をファイル駆動の冪等再開つきで運転する。
  「この UC を実装して」「実装パイプラインを回して」「実装を再開して」などで発動。
---

# dist-impl-run

引数: `{UC 指定} [specs_root={...}] [repo_root={...}]`(UC 指定は 完全修飾「業務/BUC/UC」・uc_id・一意な UC 名のいずれか)

## オーケストレータの原則

- **自分ではファイル本文をほぼ読まない**(コンテキスト 25% 制約)。読むのは
  `docs/impl/latest/` の config / uc-map / lease / status / done ファイルと、サブエージェントの報告だけ
- 各 stage は **fresh サブエージェントに委譲**する。指示文は `references/subagent-template.md` の
  テンプレートに変数を埋めて作る(パスを渡し、本文を貼らない)
- 状態の正は `references/state-schema.md`。**イベント追記 → latest 更新**の順を守る
- **git 操作は自分だけが行う**(単一コミッタ)。サブエージェントの指示に git 禁止を必ず含める

## 起動シーケンス

1. **lease 確認**: `docs/impl/latest/run-lease.yaml` が存在すれば起動を拒否して報告
   (stale 判定は state-schema.md。剥がすのはユーザー確認後)
2. **S0 判定**: `docs/impl/latest/bootstrap.done.yaml` の**全 Phase が done/skipped、かつ
   inputs_sha256 の各入力を現物から再計算して一致**していれば skip。不一致の入力があれば
   state-schema.md の依存表に従い該当 Phase を invalidate(bootstrap.done.yaml の Phase 記録を
   自分で書き換える — オーケストレータの write-set に含まれる)してから S0(bootstrap)を
   サブエージェントで実行(config/uc-map の存在では判定しない — P2 で中断した S0 を完了扱いしないため)。
   bootstrap の確認推奨項目(tier→dir / **kind** / datastore_owner / backend_framework /
   言語・コマンド)はユーザーに中継して確定(kind が未確定・不正値のままなら S0 を完了にしない)。
   **確定したら `config_confirmed` イベントを追記してから impl-config を更新する**(イベント → latest の順)
3. **UC 解決**: 引数を uc-map と照合(照合は NFC 正規化後)。
   完全修飾・uc_id・一意名のみ受理。複数一致は候補一覧を提示して選ばせる
4. **model 解決**: implementer_model / verifier_model を解決し status.yaml の `resolved_models` に記録。
   **両者が同一なら停止してユーザー確認**(二段独立検証の要件)
5. **lease 取得**: run_id・開始 HEAD(`git rev-parse HEAD`)・uc_id を run-lease.yaml に書く。
   working tree が dirty なら既存差分を記録した上で続行可否をユーザーに確認
6. **再開判定**: state-schema.md の再開手順(done 存在 + manifest_sha256 照合)で開始 stage を決める

## stage 運転規則

```
S0 bootstrap → S1 uc-init → S2 test-scaffold → S3 contracts
→ S4 tier-impl(並列) → S5 verify(並列) →(blocker あり: attempt++ で S4 へ、最大 3)
→ S6 uc-bdd → S7 atdd → S8 feedback draft → S9 implementation review
→ S8 feedback publish(要求がある場合) → completed / blocked_on_spec
```

- **S1(uc-init)は自分で実行する**(ユーザー対話を含むため):
  1. input-preflight: spec-event.yaml の files[] 実在 / YAML パース / gherkin ブロック存在 /
     tier id が arch tiers[] に含まれるか / 条件付き生成物と capability の矛盾。
     欠落・矛盾は「縮退で進める」か「変更要求を出して停止」かを分類して提示
  2. input-manifest.yaml を書く(全入力の event_id + sha256、lineage 検証)。
     `lineage_ok: false` は停止し「spec 再生成 or 旧前提で続行」をユーザーに問う
  3. UC→ATDD マッピング: uc-map の `atdd_confirmed` が false なら、usdm の
     `requirements[].specifications[].affected_models[]`(type: buc)から BUC 粒度候補を生成し、
     **全 SPEC 一覧(候補外も選択可)と併せて**ユーザー確認 → Scenario 名単位で uc-map に永続化
     (state-schema.md「UC→ATDD マッピング」。**確定時は `config_confirmed` イベントを
     追記してから uc-map を更新する**)
  4. has_design_system かつ design-event.yaml に UC の screen 結線が無い場合は警告し、
     「素の packages/ui で進める / design へ変更要求」を確認
  5. `S1_uc-init.done.yaml` を書く(共通スキーマ。オーケストレータの write-set に含まれる)
- **S3(contracts)も自分で実行する**。impl-config の `contracts[]` を loop し、契約ごとに:
  1. **鮮度照合**: contracts.lock.yaml の input sha256 と現物を照合。不一致 → bootstrap
     サブエージェントを `引数: "phase=contracts force=true contract_id={不一致の契約 id}"` で
     起動して**該当契約だけ**再生成させ、lock 更新を確認(無関係な契約の生成物・lock に触れさせない)
  2. **実装時検証**: 種別の verify(正本は `../dist-impl-bootstrap/references/contract-registry.md`)を
     **当該 UC の範囲**で実行する
     (例 rdb-schema: 当該 UC の `_model-summary.yaml` の参照テーブル・列が source に実在するか突合)。
     不整合は「dist-spec への変更要求を出して停止 / 縮退して続行」をユーザーに提示し、
     **どちらの判断でも不整合の内容を `{uc_id}/issues/{ts}_{slug}.md` に起票する**
     (S8 が feedback へ回収する経路)。**停止を選んだ場合は S3 done を書かず、
     `stage_failed` イベントを記録して lease を解放し run を終了する**(再開時は S3 から。
     distillery 側の仕様更新で契約入力が変われば照合からやり直す)。
     縮退続行は S3 done の contracts_verified に `degraded_continue` と判断を記録して進める
     (仕様で決定したレイアウトを実装前提として確定してから並走に入る gate)
  全契約の照合・検証が済んでから `S3_contracts.done.yaml`(`contracts_verified` を含む —
  state-schema.md)を書き、S4 を dispatch する。
  **lock を更新したら input-manifest の contracts_lock エントリも更新する**(contracts_lock の
  変化による stale 判定は S4 以降にのみ適用 — state-schema.md。S1/S2 を巻き戻さない)
- **S4/S5 の並列 dispatch**: uc-map の tiers を tier ごとに 1 サブエージェントで**同一メッセージ内で並列起動**。
  S5 の Verifier は **agent type に `distillery-impl:impl-verifier` を指定し、Agent/Task ツールの
  model パラメータに verifier_model を渡す**(agent 定義の disallowedTools 制約を効かせるため)
- **workspace 依存追加は単一 writer(オーケストレータ)の責務**: root package-lock.json 等の
  workspace 共有ファイルは並走 Implementer が触ると競合する。必要な依存は S4 dispatch 前(または
  attempt 開始時)にオーケストレータがまとめて install し、**依存追加だけの独立 commit**
  (`impl({uc_id}): add deps for attempt-{n}`)にしてから dispatch する(package.json /
  package-lock.json はオーケストレータの write-set — state-schema.md 正本表)
- **attempt 制御**: S5 の findings に blocker があれば `attempt_opened` イベントを記録して attempt++、
  blocker のある tier の S4 を再実行。blocker の無かった tier には新 attempt に
  **carry-forward done**(`carried_from` 付き)を自分で生成する(state-schema.md)。
  **S4 を再実行したら全 tier の S5 を再実行**(安全側。S5 は carry-forward しない)。
  attempt が 3 を超えたら停止し、findings 要約と選択肢(続行 / 仕様ブロック / 手動介入)を提示
- **S6/S7 の fail**: integration writer の分析を読み、次の 3 択から判断する(迷ったらユーザーに提示):
  ①原因 tier の S4 へ差し戻す、②仕様ブロックとして issues 起票済みのまま S8 へ進む、
  ③**(推奨)仕様不整合を issues に書き残してテストが通るまで実装を進め、S8 で as-built 差分として
  変更要求化する**(変更要求からのやり直しは時間がかかりすぎるため)。cross-UC 依存(未宣言
  エンドポイント等)はこの③が既定。
  **③の実体は①と同じ S4 差し戻し**(attempt++・carry-forward・S5 全 tier 再検証も同一)で、
  違いは Implementer への修正方針だけ — 「仕様に厳密に合わせる」でなく「issues 起票つきの意図的
  逸脱を許可して統合を通す」を指示する。tier 実装に触れない前提の欠落(認証ヘッダ等)だけは
  integration writer が自分の write-set(steps)内でハーネス注入する(subagent-template の注入規約)
- **blocked_on_spec**: S8 draft に blocker があれば、S9で実装の到達点と仕様ブロックを提示する。
  ユーザーが現在の実装を承認した後、S8 `mode=publish`で単一feedback-request Markdownを公開し、
  stateを`blocked_on_spec`として「distillery反映待ち」で終了する。stage routeの指定やfeedbackだけの
  別承認は行わない。distillery側の仕様更新でinput hashが変わった後に再開する

## stage 境界の共通処理(毎 stage)

1. サブエージェント報告から結果を検証(done ファイルの実在・スキーマ・write-set 逸脱の有無。
   スキーマ検証には `yaml.safe_load` で parse 可能であることを含める。parse 不能なら該当
   サブエージェントへ書式のみの修正を差し戻す(内容変更禁止))
2. `stage_completed`(または failed)イベントを events/ に追記 → status.yaml 更新
3. **git commit**: `git add -- <その stage の write-set のパスのみ>` →
   `impl({uc_id}): S4 tier-backend-api gates passed` 形式(Conventional Commits、scope=uc_id)。
   S0(bootstrap)など UC 非依存の commit は `impl(bootstrap): ...` とする。`git add .` は使わない
4. 必要な barrier 処理: S4 全 tier 完了後、書き換えを伴う formatter をリポ全体に 1 回実行して commit
   (単一 writer。gates.md の check-only 規約と対)

## S9 完了とレビュー依頼

1. review サブエージェント完了（`S9_review_generated.done.yaml`）後、`review/index.html` を
   `open`（macOS）/ `xdg-open`（Linux）で表示する。開けなければ絶対pathを提示する。この時点の
   stateは`awaiting_review`。S9 doneと対応するstage eventには、表示したdraftの
   `feedback_review_evidence`（feedback ID / exact bytes SHA-256 / request件数）と、表示したHTMLの
   `implementation_review_evidence`（exact bytes SHA-256 / gate結果 / open blocker・major件数）を記録する。
   S9 doneは資料生成済みを示すだけで、承認の正は`review_approved` event
2. ユーザーへ、ゲート結果、Verifierの反証、実装と仕様の差分、blockerの有無を提示し、
   **実装を承認 / 差し戻し**を問う。dist-pipelineのstage名やrouteは提示・選択させない。
   対話で出た指摘・条件は承認・差し戻しのどちらでも`review/review-notes.md`へ記録する
3. feedback draftへの訂正を含む指摘がある場合、`review_approved`をまだ記録せず、S8を
   `mode=refresh`で再実行する。更新・追加・除去を確認し、S9 HTMLを再生成してから再度実装承認を得る
4. 差し戻しの場合、`review_rejected` event（差し戻し先stageと理由）を記録し、該当stage以降のdoneを
   `invalidated/{event_id}/`へ退避して再実行する
5. 承認の場合、現在のdraft bytes/ID/件数をS9 doneとS9 stage eventの`feedback_review_evidence`へ、
   現在のreview HTML bytesとgate/open finding集約を両者の`implementation_review_evidence`へexact照合する。
   一致した場合だけ、`review_approved` eventへ`review_evidence_event_id`と両evidence mappingを記録する。
   どちらかが不一致なら承認を記録せず、S8 refresh → S9再生成 → 再レビューへ戻る。
   同じreview evidenceを参照するvalidなapprovalが既にあれば再追記せず再利用する。同じevidenceへの
   複数approval、S9 eventより前のapproval event IDはfail-closedで停止する。再レビューで新しいS9 evidenceを
   作った場合、旧approvalは履歴として残すがcurrent approvalには使わない
   feedback要求が0件ならそのままstate=`completed`、leaseを解放して終了する
6. 要求が1件以上ならstate=`publishing_feedback`とし、S8を`mode=publish`で実行する。公開先が未作成なら
   draft/公開先と全親componentがcanonical UC root内のregular/non-symlinkであること、両親が同一filesystem
   であることをfail-closedに確認してatomic renameする。公開済みpathを再開時に発見した
   場合は`feedback_request_published` event、承認・review evidence event ID、SHAを照合し、
   同じ処理を繰り返さない
7. publish後、blocker 0ならstate=`completed`、blockerありなら`blocked_on_spec`としてleaseを解放する。
   完了報告に公開Markdownのpath、feedback ID、要求件数を含め、次を1回実行する案内を出す

   ```text
   /distillery:dist-pipeline {feedback-request.md}
   ```

   推奨ルーティングを安全な範囲で自動採用したい場合は`--recommended-auto`を付ける。

### 公開後の訂正

公開済みMarkdownは、dist-pipelineをまだ実行していなくても編集しない。訂正が必要なら新しいdraftを
新feedback IDで作り、front matterの`supersedes`で旧IDを参照する。その版についてS9実装レビューを
再度承認し、S8 publishする。旧ファイルと旧`feedback_request_published` eventは残す。

## 中断・失敗時

- 任意の時点で中断しても、次回起動時の再開判定で続きから走る(中間生成物は消さない)
- **完了報告が来なくても done ファイルが正**: サブエージェントが完了報告なしで idle になる
  ことがある(ハーネス依存)。オーケストレータは報告を待たず、done ファイルの実在 + parse 可否で
  完了判定してよい。**ただし報告の代替であって検証の省略ではない** — stage 境界の共通処理
  (スキーマ・write-set 逸脱の検証)は通常どおり行う
- サブエージェントが write-set 外に書いた場合: 該当差分を退避して stage を failed 扱いにし、報告する
- 終了時(正常・異常とも)に lease を削除する。異常終了で lease が残った場合の扱いは state-schema.md
