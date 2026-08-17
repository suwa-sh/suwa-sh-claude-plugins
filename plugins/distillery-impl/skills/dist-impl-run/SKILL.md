---
name: distillery-impl:dist-impl-run
description: >
  distillery-impl のオーケストレータ。UC を指定して(または引数なしで uc-map の実施順に
  未完了 UC を自動選択・自動継続して)実装パイプライン(S0 bootstrap → S1 uc-init →
  S2 test-scaffold → S3 contracts → S4 tier 並走実装 → S5 別モデル Verifier(+ dispatch 条件を満たす
  frontend tier は実行ベースの UI Reviewer が並走)→ S6 UC BDD → S7 ATDD →
  S8 feedback → S9 review)をファイル駆動の冪等再開つきで運転する。
  「この UC を実装して」「実装パイプラインを回して」「実装を再開して」などで発動。
---

# dist-impl-run

引数: `[{UC 指定}] [specs_root={...}] [repo_root={...}]`(UC 指定は 完全修飾「業務/BUC/UC」・uc_id・一意な UC 名のいずれか。
**省略時は uc-map の実施順で次の未完了 UC を自動選択**し、completed のたびに次へ自動継続する — 起動シーケンス 3)

## オーケストレータの原則

- **自分ではファイル本文をほぼ読まない**(コンテキスト 25% 制約)。読むのは
  `docs/impl/latest/` の config / uc-map / lease / status / done ファイルと、サブエージェントの報告だけ
- 各 stage は **fresh サブエージェントに委譲**する。指示文は `references/subagent-template.md` の
  テンプレートに変数を埋めて作る(パスを渡し、本文を貼らない)。
  S2/S4/S5 ui-review/S9 の長文固定指示は `references/stage-instructions/` 配下のファイル
  (ファイル名はテンプレートの対応表が正本)の絶対パスをプロンプトに埋め、
  サブエージェント側に読ませる(テンプレートの「ファイル参照方式」参照)
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
3. **UC 解決**: 引数あり = uc-map と照合(照合は NFC 正規化後)。
   完全修飾・uc_id・一意名のみ受理。複数一致は候補一覧を提示して選ばせる。
   **引数なし = 実施順の自動選択**: uc-map の `use_cases[]`(並び順 = 実施順。
   state-schema.md)を先頭から走査し、`status.yaml` の state が `completed` でない
   最初の UC を対象にする(status.yaml が無い UC は未着手として選択対象)。
   選択した UC・残りの未完了 UC 数を報告してから進める。全 UC が completed なら
   全体完了を報告して終了する。選択した UC が `blocked_on_spec` の場合は自動で
   スキップせず、仕様還流待ちであることと「還流(dist-pipeline)を先に実行するか、
   跳ばして進むなら次の UC を明示指定する」ことを報告して停止する
   (実施順は依存順のため、前提 UC を跳ばした続行はユーザー判断に委ねる)
4. **model 解決**: implementer_model / verifier_model を解決し status.yaml の `resolved_models` に記録。
   **両者が同一なら停止してユーザー確認**(二段独立検証の要件)
5. **lease 取得**: run_id・開始 HEAD(`git rev-parse HEAD`)・uc_id を run-lease.yaml に書く。
   working tree が dirty なら既存差分を記録した上で続行可否をユーザーに確認
6. **再開判定**: state-schema.md の再開手順(done ごとの projection 照合 + 存在チェック)で
   再実行対象を決める(位置カスケードではなく、stale になった done だけが対象 —
   tier-scoped staleness)

## stage 運転規則

```
S0 bootstrap → S1 uc-init → S2 test-scaffold → S3 contracts
→ S4 tier-impl(並列) → S5 verify(並列)+ui-review(並走。dispatch 条件を満たす frontend tier のみ)
   →(blocker あり: attempt++ で S4 へ、最大 3。両レーンの findings を合算)
→ S6 uc-bdd → S7 atdd → S8 feedback draft → S9 implementation review
→ S8 feedback publish(要求がある場合) → completed / blocked_on_spec
```

- **S1(uc-init)は自分で実行する**(ユーザー対話を含むため):
  1. input-preflight: spec-event.yaml の files[] 実在 / YAML パース / gherkin ブロック存在 /
     tier id が arch tiers[] に含まれるか / 条件付き生成物と capability の矛盾。
     欠落・矛盾は「縮退で進める」か「変更要求を出して停止」かを分類して提示
  2. input-manifest.yaml を書く(全入力の event_id + sha256、lineage 検証)。
     `lineage_ok: false` は停止し「spec 再生成 or 旧前提で続行」をユーザーに問う。
     **has_design_system の場合**、`ui_imported` は state-schema.md の計算規則で
     packages/ui 配下の実体から tree hash を計算する(fail-closed: 実ファイルと
     `.imported.yaml` の path 集合の乖離・per-file sha256 不一致は「取り込みの再実行 or
     変更内容の確認」として提示する)
  3. UC→ATDD マッピング: uc-map の `atdd_confirmed` が false なら、usdm の
     `requirements[].specifications[].affected_models[]`(type: buc)から BUC 粒度候補を生成し、
     **全 SPEC 一覧(候補外も選択可)と併せて**ユーザー確認 → Scenario 名単位で uc-map に永続化
     (state-schema.md「UC→ATDD マッピング」。**確定時は `config_confirmed` イベントを
     追記してから uc-map を更新する**)
  4. **has_design_system かつ対象 UC の tiers に frontend 種別の tier が含まれる場合、
     screen 解決を確定し uc-map へ永続化する**(frontend が無い UC では `ui_screens` /
     `ui_screen_resolution` のどちらも置かない):
     design-event.yaml の `screens[]` から uc 名一致行を抽出する。リポジトリ内に同名 UC が
     複数ある場合(uc-map の {業務, BUC, UC} 識別で判定)や帰属が曖昧な場合は、確定前に
     ユーザーに確認する。確定した screen の `{name, route}` リストを `config_confirmed` イベント追記後、
     uc-map の `ui_screens` に永続化する(**非空の場合は `ui_screen_resolution` を置かない。
     design 更新後の再実行等で残存していたら削除する** — state-schema.md の XOR 制約)。
     - **0 件**の場合は「素の packages/ui で進める / design へ変更要求」を確認し、
       **`config_confirmed` イベントを追記してから** `ui_screen_resolution` に永続化する
       (`plain_ui_confirmed` または `feedback_requested`)。`feedback_requested` を選んだ場合は
       `issues/{ts}_{slug}.md` に design への変更要求を起票した上で、
       **素の packages/ui で実装を続行する**(停止しない)
     - **0 件 → 非空への遷移**(design 更新後の再実行等)では、`config_confirmed` イベントに
       `ui_screens` の before→after と `ui_screen_resolution: {before: ..., after: null}` の両方を
       含める(reducer は `after: null` を削除として適用 — state-schema.md)
     - **screen 解決の確定後、uc-map の {ui_screens, ui_screen_resolution} から
       `ui_screen_config`(canonical JSON の sha256)を計算して input-manifest に記録する**。
       手順 2 の manifest はこの反映をもって確定する(screen 解決の変更が、
       `ui_screen_config` を projection に含む done の stale 判定に乗る)
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
- **S5 UI Reviewer の並走 dispatch**(D8。dist-impl-verify とは対象も手段も異なる独立レーン):
  1. **executable target 集合を自分で算出**する(この算出規則が唯一の正本。test-strategy.md の
     S2 対象・dist-impl-ui-review/SKILL.md の target 前提はここを参照する): uc-map の `ui_screens` を
     design-event.yaml まで解決した `screens[]` 行のうち、`story` の実体が packages/ui に存在し
     `variants` が非空の行の(screen × variant)集合。`ui_screens` が非空でも target が 0 件になり得る
     (story/variants は optional のため)。**さらに、tier-rules.md の矛盾 3 条件(story path 実体の
     不在 / variants と named export の不一致 / components 宣言と story 実体の不一致)に該当する
     行・variant は集合から除外する**(除外対象は実行ベースの検証に持ち込まず、Verifier
     手順 6 の major findings / issues 経路でのみ扱う — 入力ソース間矛盾は実装で解消不能なため)。
     除外した行があれば理由を起動テンプレートの指示に含める。**算出した target 集合の
     canonical hash(`targets_hash`)と件数(`targets_count`)も算出する**(計算規則は
     state-schema.md「dispatch target の canonical hash」)
  2. **dispatch するのは**「対象 UC の tiers のうち `tiers[].capabilities.ui_review` の
     `dom_snapshot: true` または `capture_review: enabled` のいずれかを満たす frontend tier」かつ
     「手順 1 の executable target が 1 件以上」の場合のみ。`dom_snapshot: false` かつ
     `capture_review: disabled` の tier には起動しない(読解ベースの照合表は Verifier 手順 6 が
     担保。重複検証を作らない)
  3. dispatch する tier があれば、Verifier と**同一メッセージ内で**並列起動する(agent type は
     `distillery-impl:impl-verifier`、model は verifier_model を流用 — impl-config にキーを
     増やさない)。skill 名は `distillery-impl:dist-impl-ui-review`、算出した target 集合と
     `targets_hash`・`targets_count` を引数で渡す(subagent-template.md の S5 ui-review テンプレート)
  4. **UI Reviewer の done が `environment_failure` の場合の縮退遷移**(dom_snapshot テストの
     実行環境自体が壊れている場合のみ到達する — capture_review はこの状態に到達しない。D10。
     writer はオーケストレータ。UI Reviewer 自身は縮退を書かない):
     - `{uc_id}/issues/{ts}_{slug}.md` に起票する
     - ユーザーに縮退可否を確認する
     - **承認**: `config_confirmed` イベントを追記した上で該当 tier の `tiers[].capabilities.ui_review`
       を done の `degradation_proposed` に従って更新し、`ui_review_config` の変化により
       これを projection に含む done(S2 以降の global done・全 tier done)を invalidate する
       (state-schema.md の projection 規則に従う)
     - **拒否**: `stage_failed` イベントを記録して lease を解放し run を終了する(再開時は S5 から。
       環境を直すか縮退を選ぶまで進まない — S3 の既存停止パターンと同じ)
  5. **UI Reviewer の done が `unverified` の場合**(dispatch 前提とのズレ): 再開時に dispatch 条件・
     executable target を再算出する。**再算出後も target が 0 件**なら、既存の `unverified` done を
     invalidate して `executable_target_zero` の非 dispatch 状態に合流させ(以後 dispatch しない)、
     **1 件以上**なら同一 attempt で UI Reviewer を再 dispatch する(state-schema.md 再開手順を正本とする)
  6. **UI Reviewer の done が `result: pass` かつ `checks_checked.capture_review: {status: skipped,
     reason: runtime_unavailable}` の場合**(browser ツールが本セッションで利用不能だった。D10):
     縮退確認は不要(environment_failure ではないため)。再開時、**現セッションで browser 系
     ツールが利用可能**かつ**`S6_uc-bdd.done.yaml` 以降の done がまだ存在しない**場合のみ、
     以下を判定する: **(i) 対応イベントの無い `staging/`(orphan)を検出したら破棄**(D10
     round2)、**(ii) `capture_review_completed` イベントは存在するが canonical が期待 hash に
     未到達(昇格が中断)なら冪等に再遂行**(D8 round3。両方の詳細は state-schema.md
     「orphan 検出」「冪等再遂行」を正本とする)。どちらでもなければ
     `distillery-impl:dist-impl-ui-review` を `checks=capture_review` を渡して同一 attempt で
     再 dispatch する(dom_snapshot は再実行しない)。UI Reviewer は成果物を
     `attempt-{n}/ui-artifacts/{tier_id}/staging/` にのみ書き、更新後の `checks_checked` 全文
     (`checks_checked_after`)・staged ファイル一覧・各ハッシュを完了報告で返す(canonical
     latest/ は書き換えない)。オーケストレータは報告値を `staging/` の実測と照合するだけでなく、
     **イベント追記の前に** staging の内容(canonical findings の dom_snapshot 分 +
     `findings-delta.yaml` の capture_review 追記分)から「マージ後 findings 候補」を構築し、
     **通常の S5 受理(下記手順 7)と同じ全検証**(`checks_checked` 完全一致・`captures[].target`
     と dispatch target の 1:1 対応・`capture_index` の範囲と参照先 `result: diff`)を実施する
     (D8 round3。sha 自己整合だけで昇格しない)。**全検証 pass の場合のみ**、検証済み候補から
     算出した hash を payload に持たせて **`capture_review_completed` イベント(payload に
     staged→canonical 対応表を含む。stage_completed は流用しない)を追記し、その後に**
     staging→canonical への昇格(ファイル移動・findings マージ・done の `checks_checked` 更新)を
     行う(イベント先行。state-schema.md の順序原則どおり)。**検証に失敗したら イベントを
     書かず** `staging/` を orphan のまま残す(次回再開時に discard して再実行)。追加 findings に
     blocker があれば通常の attempt 制御に乗る。**S6 以降が完了済みならこの attempt では
     再実行しない**(承認済み証跡の失効・再承認の複雑さを持ち込まないため。state-schema.md の
     再開手順を正本とする)
  7. **S5 受理時の fail-closed 検証**(D8 round2。「stage 境界の共通処理」の一部として実施):
     UI Reviewer の done が持つ `dispatch_targets.hash`/`count` を、自分が dispatch 時に算出した
     `targets_hash`/`targets_count` と照合する。`checks_checked.capture_review.status: done` の
     場合はさらに、`.findings.yaml` の `captures[].target` が dispatch した executable target
     集合と 1:1 対応する(欠落・重複・過剰なし)ことと、capture_review の finding が
     `0 <= capture_index < captures.length` かつ参照先 `captures[capture_index].result: diff` で
     あることを検証する。**いずれか不一致なら S5 を受理しない**(stage failed 扱い。
     state-schema.md「captures[] の網羅性検証」を正本とする)
- **workspace 依存追加は単一 writer(オーケストレータ)の責務**: root package-lock.json 等の
  workspace 共有ファイルは並走 Implementer が触ると競合する。必要な依存は S4 dispatch 前(または
  attempt 開始時)にオーケストレータがまとめて install し、**依存追加だけの独立 commit**
  (`impl({uc_id}): add deps for attempt-{n}`)にしてから dispatch する(package.json /
  package-lock.json はオーケストレータの write-set — state-schema.md 正本表)
- **attempt 制御**: **S5 verify と ui-review、両レーンの findings を合算**して blocker 判定する
  (ui-review が dispatch されなかった tier は verify のみで判定)。blocker があれば
  `attempt_opened` イベントを記録して attempt++、blocker のある tier の S4 を再実行。
  blocker の無かった tier には新 attempt に**carry-forward done**(`carried_from` 付き)を
  自分で生成する(state-schema.md)。**attempt++ 経由(blocker 由来・S6/S7 差し戻し)で S4 を
  再実行したら全 tier の S5(verify + dispatch 対象なら ui-review も)を再実行**(安全側。
  どちらのレーンも carry-forward しない)。
  **attempt++ 経由の S4 再実行時は両レーンの findings パスを tier 単位で Implementer に渡す**
  (subagent-template.md の S4 の findings 変数。ui-review も carry-forward しない)。
  attempt が 3 を超えたら停止し、findings 要約と選択肢(続行 / 仕様ブロック / 手動介入)を提示。
  **stale 由来の再実行(再開手順の projection 照合)はこの attempt 制御に乗せない**:
  attempt++ せず同一 attempt 内で stale な tier の S4/S5 のみ再実行し、findings も渡さない
  (旧 spec 前提の指摘を新実装に持ち込まない)。他 tier の有効な done は維持する
  (state-schema.md 再開手順 6 が正本)
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
   サブエージェントへ書式のみの修正を差し戻す(内容変更禁止))。**S5 UI Reviewer(通常 dispatch)は
   さらに、done の `checks_checked` が `.findings.yaml` の `checks_checked` と完全一致すること・
   S5 受理時の fail-closed 検証(上記 S5 dispatch 手順 7)を満たす**
2. `stage_completed`(または failed)イベントを events/ に追記 → status.yaml 更新
3. **git commit**: `git add -- <その stage の write-set のパスのみ>` →
   `impl({uc_id}): S4 tier-backend-api gates passed` 形式(Conventional Commits、scope=uc_id)。
   S0(bootstrap)など UC 非依存の commit は `impl(bootstrap): ...` とする。`git add .` は使わない
4. 必要な barrier 処理: 当該サイクルで S4 を実行した tier が全て完了した後、書き換えを伴う
   formatter をリポ全体に 1 回実行して commit(単一 writer。gates.md の check-only 規約と対)。
   **barrier commit の前に変更パスを検査し、今回 S4 を実行していない tier の tier_dir に
   整形差分が出た場合は、その tier の S5(verify + dispatch 対象なら ui-review)を追加で
   invalidate して再実行する**(維持された S5 done が整形前コードの検証記録のまま残らないようにする。
   tier-scoped staleness の補償規則)

## S9 完了とレビュー依頼

1. review サブエージェント完了（`S9_review_generated.done.yaml`）後、`review/index.html` を
   `open`（macOS）/ `xdg-open`（Linux）で表示する。開けなければ絶対pathを提示する。この時点の
   stateは`awaiting_review`。S9 doneと対応するstage eventには、表示したdraftの
   `feedback_review_evidence`（feedback ID / exact bytes SHA-256 / request件数）と、表示したHTMLの
   `implementation_review_evidence`（exact bytes SHA-256 / gate結果 / open blocker・major件数 /
   captures_sha256。capture_review のスクショが承認後に置換・欠損していないことの証跡)を記録する。
   S9 doneは資料生成済みを示すだけで、承認の正は`review_approved` event
2. ユーザーへ、UCと対象仕様、実装の構成・処理・データフロー、動かし方、テストと確認方法、
   現在の仕様差分とblockerの有無を人間向け名称で提示し、**実装を承認 / 差し戻し**を問う。
   `S1`等の内部stage code、attempt履歴、dist-pipelineのstage名やrouteは提示・選択させない。
   対話で出た指摘・条件は承認・差し戻しのどちらでも`review/review-notes.md`へ記録する
3. feedback draftへの訂正を含む指摘がある場合、`review_approved`をまだ記録せず、S8を
   `mode=refresh`で再実行する。更新・追加・除去を確認し、S9 HTMLを再生成してから再度実装承認を得る
4. 差し戻しの場合、`review_rejected` event（差し戻し先stageと理由）を記録し、該当stage以降のdoneを
   `invalidated/{event_id}/`へ退避して再実行する
5. 承認の場合、現在のdraft bytes/ID/件数をS9 doneとS9 stage eventの`feedback_review_evidence`へ、
   現在のreview HTML bytesとgate/open finding集約・**current capture imagesの再検証
   (captures[]の非skippedエントリの実測SHA-256と`captures_sha256`の整合)**を両者の
   `implementation_review_evidence`へexact照合する。
   一致した場合だけ、`review_approved` eventへ`review_evidence_event_id`と両evidence mappingを記録する。
   どちらかが不一致なら承認を記録せず、S8 refresh → S9再生成 → 再レビューへ戻る。
   同じreview evidenceを参照するvalidなapprovalが既にあれば再追記せず再利用する。同じevidenceへの
   複数approval、S9 eventより前のapproval event IDはfail-closedで停止する。再レビューで新しいS9 evidenceを
   作った場合、旧approvalは履歴として残すがcurrent approvalには使わない
   feedback要求が0件ならstate=`completed`とし、`{uc_id}/NEXT.md`を「還流不要(要求0件)」の内容で
   上書き生成して、`review_approved` eventの追記分・status.yaml・更新済み`review/review-notes.md`と
   **同一commit**(明示path)にしてからleaseを解放して終了する(前サイクルの還流指示を残さない。
   派生物だけをcommitしない — state-schema.md「NEXT.md」のcommit境界)。
   **連続運転(引数なし起動のみ)**: この経路(要求0件のcompleted)でlease解放後、
   起動シーケンス3の自動選択で次の未完了UCへ継続する(lease取得からやり直す)。
   継続のたびに「n/全UC完了、次: {uc}」を報告する。要求ありのcompleted・blocked_on_spec・
   awaiting_review等ユーザー入力や還流を要する停止では継続せず、従来どおり案内して終了する
6. 要求が1件以上ならstate=`publishing_feedback`とし、S8を`mode=publish`で実行する。公開先が未作成なら
   draft/公開先と全親componentがcanonical UC root内のregular/non-symlinkであること、両親が同一filesystem
   であることをfail-closedに確認してatomic renameする。公開済みpathを再開時に発見した
   場合は`feedback_request_published` event、承認・review evidence event ID、SHAを照合し、
   同じ処理を繰り返さない
7. publish後、blocker 0ならstate=`completed`、blockerありなら`blocked_on_spec`とする。
   **lease保持中に**`{uc_id}/NEXT.md`(セッション引き継ぎカード — 書式は state-schema.md)を上書き生成し、
   明示pathでcommit(`impl({uc_id}): write NEXT.md handoff card`。terminal遷移に至る未commitの
   write-set — events/追記分・status.yaml・S8 publish成果物・更新済みreview-notes.md — があれば
   同一commitに含める — state-schema.mdのcommit境界が正本)してから、leaseを解放する
   (単一コミッタ規則の内側で完結させる。commit前にleaseを剥がさない)。
   完了報告に公開Markdownのpath、feedback ID、要求件数、NEXT.mdのpathを含め、
   **還流はこのセッションで続けない**。次の案内を出して終了する:
   「**コンテキストをクリアして**(`/clear` または新セッション)、次を1回実行してください」

   ```text
   /distillery:dist-pipeline {feedback-request.md}
   ```

   推奨ルーティングを安全な範囲で自動採用したい場合は`--recommended-auto`を付ける。
   還流に必要な情報はすべてファイル側にある(公開Markdown / docs/ 配下)ため、
   本セッションの会話コンテキストを持ち越す必要はない。dist-pipeline完了後の本スキル再開も
   同様に新セッションでよい(再開判定はファイル駆動)。

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
