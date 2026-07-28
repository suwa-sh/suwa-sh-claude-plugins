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
   bootstrap の確認推奨項目(tier→dir / **kind** / datastore_owner / 言語・コマンド)は
   ユーザーに中継して確定(kind が未確定・不正値のままなら S0 を完了にしない)
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
→ S6 uc-bdd → S7 atdd → S8 feedback → S9 review → completed
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
     (state-schema.md「UC→ATDD マッピング」)
  4. has_design_system かつ design-event.yaml に UC の screen 結線が無い場合は警告し、
     「素の packages/ui で進める / design へ変更要求」を確認
  5. `S1_uc-init.done.yaml` を書く(共通スキーマ。オーケストレータの write-set に含まれる)
- **S3(contracts)も自分で実行する**: contracts.lock.yaml の inputs sha256 と現物を照合。
  一致 → `S3_contracts.done.yaml` を書いて次へ / 不一致 → bootstrap サブエージェントを
  `引数: "phase=contracts force=true"` で起動して再生成させ、lock 更新を確認してから done を書く。
  **lock を更新したら input-manifest の contracts_lock エントリも更新する**(contracts_lock の
  変化による stale 判定は S4 以降にのみ適用 — state-schema.md。S1/S2 を巻き戻さない)
- **S4/S5 の並列 dispatch**: uc-map の tiers を tier ごとに 1 サブエージェントで**同一メッセージ内で並列起動**。
  S5 の Verifier は **agent type に `distillery-impl:impl-verifier` を指定し、Agent/Task ツールの
  model パラメータに verifier_model を渡す**(agent 定義の disallowedTools 制約を効かせるため)
- **attempt 制御**: S5 の findings に blocker があれば `attempt_opened` イベントを記録して attempt++、
  blocker のある tier の S4 を再実行。blocker の無かった tier には新 attempt に
  **carry-forward done**(`carried_from` 付き)を自分で生成する(state-schema.md)。
  **S4 を再実行したら全 tier の S5 を再実行**(安全側。S5 は carry-forward しない)。
  attempt が 3 を超えたら停止し、findings 要約と選択肢(続行 / 仕様ブロック / 手動介入)を提示
- **S6/S7 の fail**: integration writer の分析を読み、原因 tier の S4 へ差し戻すか
  仕様問題(issues 起票済み)として S8 へ進むかを判断(迷ったらユーザーに提示)
- **blocked_on_spec**: S8 が blocker の変更要求を出したら state を blocked_on_spec にし、
  S9 で「仕様ブロック」レポートを出して終了(distillery 側の対応後に再開)

## stage 境界の共通処理(毎 stage)

1. サブエージェント報告から結果を検証(done ファイルの実在・スキーマ・write-set 逸脱の有無)
2. `stage_completed`(または failed)イベントを events/ に追記 → status.yaml 更新
3. **git commit**: `git add -- <その stage の write-set のパスのみ>` →
   `impl({uc_id}): S4 tier-backend-api gates passed` 形式(Conventional Commits、scope=uc_id)。
   `git add .` は使わない
4. 必要な barrier 処理: S4 全 tier 完了後、書き換えを伴う formatter をリポ全体に 1 回実行して commit
   (単一 writer。gates.md の check-only 規約と対)

## S9 完了とレビュー依頼

1. review サブエージェント完了(`S9_review_generated.done.yaml`)後、`review/index.html` を
   `open`(macOS)/ `xdg-open`(Linux)でプレビュー表示(開けない環境ではパスを提示)。
   この時点の state は `awaiting_review`(**UC 完了の正は `review_approved` イベント**。
   承認前に中断しても再開時は state-schema.md の awaiting_review 分岐でここへ戻る)
2. 「承認(completed にする)/ 差し戻し(どの stage へ戻すか)」をユーザーに問う
3. 承認 → `review_approved` イベント + status を completed に。lease を削除して完了報告。
   差し戻し → `review_rejected` イベント(payload に差し戻し先 stage)を記録し、
   差し戻し先以降の done を `invalidated/{event_id}/` へ退避(`stage_invalidated` イベント。
   state-schema.md「done の退避」)してから該当 stage を再実行
4. 完了報告には S8 の変更要求・learnings・提案(skill / コンテキスト)の要約と、
   変更要求を dist-requirements へ渡す案内を含める

## 中断・失敗時

- 任意の時点で中断しても、次回起動時の再開判定で続きから走る(中間生成物は消さない)
- サブエージェントが write-set 外に書いた場合: 該当差分を退避して stage を failed 扱いにし、報告する
- 終了時(正常・異常とも)に lease を削除する。異常終了で lease が残った場合の扱いは state-schema.md
