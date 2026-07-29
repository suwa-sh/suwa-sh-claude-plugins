# 状態スキーマ正本(distillery-impl)

distillery-impl の全状態は `docs/impl/` 配下の**ファイル駆動**で永続化する。
イベントソーシング規約は distillery の `event-sourcing-rules.md` に従う:
**「イベントを `events/` に追記してから `latest/` を更新する」**。`latest/` はイベントを順に適用した結果であり、イベントから再構築可能でなければならない。

## ディレクトリ構造

```
docs/impl/
  events/{event_id}/            # 追記のみ・イミュータブル
    event.yaml                  # 下記「イベントスキーマ」
    _changes.md                 # 人間可読の変更サマリ
  latest/
    impl-config.yaml
    uc-map.yaml
    contracts.lock.yaml
    bootstrap.done.yaml         # S0 の完了判定(Phase ごとの完了記録 + 入力ハッシュ)
    run-lease.yaml              # 実行中のみ存在
    {uc_id}/
      status.yaml
      input-manifest.yaml
      stages/
        S1_uc-init.done.yaml
        S2_test-scaffold.done.yaml
        S3_contracts.done.yaml
        attempt-{n}/
          S4_tier-impl.{tier_id}.done.yaml    # carry-forward の場合は carried_from を持つ
          S5_verify.{tier_id}.done.yaml
          S5_verify.{tier_id}.findings.yaml
        S6_uc-bdd.done.yaml
        S7_atdd.done.yaml
        S8_feedback.done.yaml
        S9_review_generated.done.yaml   # HTML 生成の完了(承認は含まない)
      invalidated/{event_id}/         # 無効化した done の退避先(stage_invalidated と対)
      issues/{ts}_{slug}.md
      change-requests/_as-built-summary.md   # S8 が変更要求の前に生成する as-built 仕様サマリ
                                             # (変更要求ではない — 件数集計・S9 の変更要求一覧から除外)
      change-requests/{ts}_{slug}.md
      learnings/{ts}_{slug}.md
      review/index.html
      review/review-notes.md          # S9 承認対話の要点(オーケストレータが追記。S8 refresh の入力)
```

- `event_id` の形式は distillery と同じ `{YYYYMMDD_HHMMSS}_{summary_slug}`(`date +%Y%m%d_%H%M%S` で取得)
- **完了判定の正は `.done.yaml` の存在**。`status.yaml` はスナップショットであり、壊れても done ファイルから再構築する
- 中断・失敗時も中間生成物は削除しない(冪等再開のため)

## uc_id の生成式

UC には ID が無く日本語名がキーのため、決定論的な短縮 ID を発行する:

```bash
python3 -c "
import hashlib, json, sys, unicodedata
parts = [unicodedata.normalize('NFC', p) for p in sys.argv[1:4]]
print(hashlib.sha256(json.dumps(parts, ensure_ascii=False).encode()).hexdigest()[:8])
" "{業務}" "{BUC}" "{UC}"
```

- 入力は **canonical JSON 配列**(区切り文字入り名でも安全)、**必ず NFC 正規化**(macOS の NFD 分解対策)
- 既定 8 桁。uc-map 生成時に全 UC で衝突検査し、衝突したら**その uc-map 全体を 12 桁に延長**(決定論的)
- 実装リポ・feature ファイル・状態ファイルは uc_id のみを使う(日本語パスをコード側へ持ち込まない)

## イベントスキーマ(events/{event_id}/event.yaml)

```yaml
event_id: "20260801_103000_s4_tier_impl_completed"
type: stage_started | stage_completed | stage_failed | attempt_opened |
      stage_carried_forward | stage_invalidated | config_confirmed |
      finding_reported | finding_resolved | review_approved | review_rejected |
      bootstrap_completed | change_request_issued
uc_id: "3f9a2b1c"          # グローバルイベント(bootstrap 等)では null
stage: "S4"                 # 該当する場合のみ
tier: "tier-backend-api"    # 該当する場合のみ
attempt: 1                  # S4/S5 のみ
payload: {}                 # type 固有の付帯情報(findings 件数、失敗理由等)
created_at: "2026-08-01T10:30:00+09:00"
```

**reducer 規則**(latest の再構築): イベントを `event_id` 昇順に適用する。
`stage_completed` → 対応する done ファイルを再生成 / `attempt_opened` → attempt カウンタを進める /
`stage_carried_forward`(payload: 元 attempt・tier・元 done の sha256)→ 新 attempt に
`carried_from` 付き done を再生成 / `stage_invalidated`(payload: 対象 stage 範囲・理由・退避先)→
該当 done を無効化 / `config_confirmed`(payload: 確定項目の before→after・confirmed_by)→
impl-config.yaml / uc-map.yaml の該当項目を確定値で上書き / `review_approved` → UC を completed にする。
`latest/` と食い違ったら events が正。

**done の退避(invalidate)**: review_rejected・stale 検知などで done を無効化するときは、
オーケストレータが**先に `stage_invalidated` イベント(payload: 対象 done 一覧・退避先)を追記し、
その後に** `latest/{uc_id}/invalidated/{event_id}/` へ該当 done を移動する
(「イベント追記 → latest 更新」の順序原則と同じ。削除しない。この移動はオーケストレータの write-set に含まれる)。

**S8 refresh**(S9 承認後のヒトレビュー反映)は `stage_completed`(stage: S8、payload.mode:
refresh)を追記し、`S8_feedback.done.yaml` に `refreshed_at` を追記する(done の作り直しはしない)。

**UC 完了の正は `review_approved` イベント**(S9 の done は「HTML 生成済み」まで)。
S9_review_generated.done.yaml があり review_approved が無い状態 = `awaiting_review`。
`review_rejected` イベントは payload に差し戻し先 stage を持ち、該当 stage 以降の done を退避して再実行する。

## impl-config.yaml

```yaml
schema_version: "1.0"
specs_root: "docs"                     # distillery 出力のルート(docs/specs, docs/arch, ...)
repo_root: "impl"                      # 実装先リポのルート(相対 or 絶対)
tiers:                                 # 実装 tier の宣言(architecture tier と別概念)
  - id: tier-frontend
    dir: frontend
    kind: frontend                     # frontend | backend | worker。read-set 分岐・tier-rules 適用の機械可読キー
    lang: typescript                   # (tier id からの推測はしない。P2 でユーザー確認して確定する必須項目)
    commands: {format_check: "...", lint: "...", test: "...", bdd: "..."}
  - id: tier-backend-api
    dir: backend-api
    kind: backend
    lang: typescript
    commands: {format_check: "...", lint: "...", test: "...", bdd: "..."}
datastore_owner: tier-backend-api      # migration/schema 資産の所有 tier
backend_framework: express             # backend tier の API フレームワーク(P2 でユーザー確認して確定。
                                       #  P3 はこの宣言の依存を install する)
integration_commands:                  # S6/S7 で integration writer が使う
  uc_bdd: "..."
  atdd: "..."
implementer_model: null                # null = セッション既定モデル
verifier_model: "..."                  # ★ model の正はここに一本化(agents/ 定義には書かない)
capabilities:                          # bootstrap の存在プローブ結果
  has_asyncapi: false
  has_kvs: false
  has_object_storage: false
  has_design_system: true
```

- **architecture tier(arch-design.yaml の tiers[])と実装 tier は別概念**。UC の files[] に現れない
  architecture tier(例 tier-datastore)は「実装対象外 or 共有資産」を本ファイルの宣言で解決する
- 未知の tier id(arch tiers[] に無い)が spec-event.yaml に現れたら**停止して変更要求を出す**(推測しない)

## uc-map.yaml

```yaml
schema_version: "1.0"
id_length: 8                           # 衝突時 12 に延長
use_cases:
  - uc_id: "3f9a2b1c"
    business: "貸出管理業務"
    buc: "貸出管理フロー"
    uc: "書籍を貸出する"
    path: "docs/specs/latest/貸出管理業務/貸出管理フロー/書籍を貸出する"
    tiers: [tier-frontend, tier-backend-api]   # spec-event.yaml の files[] から確定
    atdd_scenarios: []                 # UC→ATDD の対応(Scenario 名単位。下記)。例 ["SPEC-002-01-1"]
    atdd_confirmed: false
```

**UC→ATDD マッピングは Scenario(acceptance criterion)単位**: distillery 出力に UC→SPEC の
機械可読対応は存在せず、さらに **1 つの SPEC が複数 UC の受け入れ基準を含む実例がある**
(サンプルの SPEC-001-01 は「登録」と「編集」の 2 基準を持つ)ため、SPEC-ID 単位の対応では
粗すぎる。ATDD feature は 1 criterion = 1 Scenario(命名 `{SPEC-ID}-{連番}`)として生成し、
uc-map には **Scenario 名の配列**で対応を持つ。

候補生成(S1): `requirements.yaml` の `requirements[].specifications[].affected_models[]`
(type: buc)から BUC 粒度の候補を出す。**BUC 名は `name` でなく `target` キー**
(例 `{type: buc, action: add, target: 貸出管理フロー}`)。ただし **affected_models に buc が無い SPEC も実在する**
(サンプルの SPEC-002-02)ため、候補外も選べる形で提示する。
**提示は Scenario(criterion)単位**: 候補・全件一覧とも
`{Scenario 名({SPEC-ID}-{連番}), criterion 原文, SPEC の specification 要約, affected BUC}` の行で出す
(SPEC 要約だけでは同一 SPEC 内の criterion を選び分けられない)。
保存前に Scenario 名の実在(features/atdd/ に生成済みか)・重複・空集合を検証してから
`atdd_scenarios` に永続化する。確認済み(`atdd_confirmed: true`)の UC は再確認しない。
マッピング出力の機械化は dist-spec への変更要求として起票する。

## contracts.lock.yaml

```yaml
schema_version: "1.0"
inputs:
  openapi: {path: "docs/specs/latest/_cross-cutting/api/openapi.yaml", sha256: "..."}
  asyncapi: {path: "...", sha256: "..."}    # capability がある場合のみ
generated:
  - {dir: "packages/contracts/api-types", generator: "typescript-fetch", at: "..."}
generated_at: "..."
```

S3 で inputs の sha256 を照合し、不一致なら契約再生成のみ実行して lock を更新する。

## bootstrap.done.yaml(S0 の完了判定)

```yaml
schema_version: "1.0"
phases:                                # Phase ごとの完了記録。専用マーカーであり、
  P1_preflight: {status: done, at: "..."}   # 生成物(CLAUDE.md 等)の存在を完了判定に使わない
  P2_config: {status: done, at: "..."}      # (既存リポに元からあるファイルと区別できないため)
  P3_skeleton: {status: done, at: "..."}
  P4_contracts: {status: done, at: "..."}
  P5_ui: {status: skipped, reason: "has_design_system: false"}
  P6_ci: {status: done, at: "..."}
  P7_atdd: {status: done, at: "..."}
inputs_sha256:                         # 全入力のハッシュ(現物と比較して Phase invalidate に使う)
  spec_event: "..."
  arch: "..."
  usdm: "..."
  design: "..."                        # has_design_system の場合のみ
  design_storybook_src: "..."          # has_design_system の場合のみ。storybook-app/src/ 配下の
                                        # 実ファイル一覧 + 各 sha256 から決定論的に合成したハッシュ
                                        # (design event 単体のハッシュでは src/ 配置競合による
                                        #  部分スナップショット取り込みを検知できないため)。
                                        # 記録するのは P5 が実際にコピーした時点の値: P5 は
                                        # コピー前後で同一ハッシュであることを確認し、
                                        # .imported.yaml の files と src 実ファイル一覧の
                                        # 全件一致を P5 完了条件にする
  openapi: "..."
  asyncapi: "..."                      # has_asyncapi の場合のみ
generated_at: "..."
```

- **S0 の完了判定は「全 Phase done/skipped」+「入力ハッシュの現物一致」の両方**。
  オーケストレータは起動時に inputs_sha256 の各入力を現物から再計算し、
  不一致の入力に依存する Phase を invalidate する(bootstrap.done.yaml の Phase 記録の
  書き換えはオーケストレータの write-set に含まれる)。依存表:
  spec_event/arch → P2 以降すべて / usdm → P7 / design → P5 / design_storybook_src → P5 /
  openapi・asyncapi → P4 /
  **条件付き入力(asyncapi / kvs / object-storage / storybook-app)の存在自体の増減 →
  P1・P2(capability と config の再判定)+ 対応する生成 Phase**。
  invalidate された Phase は bootstrap 再実行の対象になる
- inputs_sha256 には spec_event / arch / usdm / design / openapi / asyncapi(存在するもの)に加え、
  条件付き入力の**存在フラグ**(exists: true/false)を記録する(欠落 → 出現も検知するため)
- bootstrap 再実行時は本ファイルの Phase 記録(invalidate 反映後)で skip を決める(冪等)

## run-lease.yaml(多重起動の拒否)

```yaml
run_id: "{event_id 形式}"
uc_id: "3f9a2b1c"
started_head: "{git rev-parse HEAD}"
acquired_at: "..."
pid_hint: "..."
```

- run 開始時に存在チェック → **存在すれば起動拒否**(別 run が実行中)。正常終了・中断確定時に削除
- stale lease(acquired_at が 24h 超 + 対応 run の活動なし)はユーザー確認の上で剥がす

## input-manifest.yaml({uc_id} 配下)

```yaml
schema_version: "1.0"
uc_id: "3f9a2b1c"
fixed_at: "..."
inputs:
  spec_event: {event_id: "spec:20260412_195542_...", sha256: "..."}
  spec_md: {path: "...", sha256: "..."}
  tier_mds: [{tier: tier-frontend, path: "...", sha256: "..."}]   # ファイル名は {tier_id}.md(例 tier-frontend.md)
  api_summary: {path: "...", sha256: "..."}
  model_summary: {path: "...", sha256: "..."}
  datastore_schema: {path: "_cross-cutting/datastore/rdb-schema.yaml", sha256: "..."}
  nfr: {path: "docs/nfr/latest/nfr-grade.yaml", sha256: "..."}    # Verifier の性能・可用性判定の根拠
  usdm: {event_id: "...", sha256: "..."}
  arch: {event_id: "...", sha256: "..."}
  design: {event_id: "...", sha256: "..."}   # has_design_system の場合のみ
  contracts_lock: {path: "docs/impl/latest/contracts.lock.yaml", sha256: "..."}   # 契約生成物の版
                                       # ※ contracts_lock の変化による stale 判定は S4 以降にのみ適用する
                                       #   (S3 が lock を正当に更新した直後に S1/S2 が巻き戻るのを防ぐ。
                                       #    S3 は lock 更新後にこのエントリを更新する)
  ui_imported: {path: "packages/ui/.imported.yaml", sha256: "..."}               # has_design_system のみ
  dev_rules_sha256: "..."
lineage_ok: true                       # spec-event の trigger_event と arch/design の event_id 整合
```

- **latest 同士の系譜不整合は実在する**(サンプルでも spec の trigger より arch latest が新しい)。
  `lineage_ok: false` の場合は停止し、「spec を再生成するか / 旧 arch 前提で進めるか」をユーザーに問う
- 各 `.done.yaml` は `manifest_sha256`(input-manifest.yaml 全体のハッシュ)を持つ。再開時に現在の
  manifest と比較し、**不一致なら該当 stage 以降の done を無効扱い**にする(ファイルは消さず退避)

## status.yaml({uc_id} 配下・スナップショット)

```yaml
schema_version: "1.0"
uc_id: "3f9a2b1c"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
state: running | blocked_on_spec | awaiting_review | completed
current_attempt: 1
resolved_models: {implementer: "...", verifier: "..."}   # 起動時に記録。同一なら停止して確認
stages:
  S1_uc_init: {status: done}
  S2_test_scaffold: {status: done, red_baseline: pass}
  S3_contracts: {status: done}
  S4_tier_impl:
    tier-frontend: {status: running, attempt: 1, gates: {format: pass, lint: pass, tdd: pending, bdd_tier: pending}}
    tier-backend-api: {status: pending, attempt: 1}
  S5_verify:
    tier-frontend: {status: pending, attempt: 1, open_blockers: 0}
  S6_uc_bdd: {status: pending}
  S7_atdd: {status: pending}
  S8_feedback: {status: pending}
  S9_review: {status: pending}
updated_at: "..."
```

## done ファイル(.done.yaml 共通スキーマ)

```yaml
stage: "S4"
tier: "tier-backend-api"      # tier stage のみ
attempt: 2                    # S4/S5 のみ
uc_id: "3f9a2b1c"
manifest_sha256: "..."        # input-manifest.yaml のハッシュ(stale 検知)
result: pass
gates: {format: pass, lint: pass, tdd: pass, bdd_tier: pass}   # S4 のみ
carried_from: "attempt-1"     # carry-forward の場合のみ(下記)
completed_at: "..."
completed_by: "dist-impl-implement"   # 書いた skill 名
```

**attempt の carry-forward**: attempt++ で S4 を再実行するのは blocker のあった tier だけ。
blocker の無かった tier については、オーケストレータが `stage_carried_forward` イベントを記録した上で
新 attempt ディレクトリに `carried_from: attempt-{n}` 付きの S4 done をコピー生成する
(実装は変わっていないため。イベント → latest の順は他の状態変更と同じ)。
これにより「再開判定は current attempt 内だけを見る」規則が維持される。
S5(verify)は carry-forward しない(S4 再実行後は全 tier を再検証する。安全側)。

## 再開手順(オーケストレータが実行)

1. `run-lease.yaml` を確認 → 存在すれば起動拒否
2. `bootstrap.done.yaml` で S0 の完了を判定(全 Phase done/skipped + 入力ハッシュの現物一致。
   不一致入力の依存 Phase は invalidate して bootstrap を再実行)
3. **input-manifest を現物から再計算する**: S1 done が存在しても、保存済み manifest と
   現物再計算値が食い違えば manifest を更新し、以降の done を stale と判定する
   (保存済み manifest 同士の比較だけでは入力変更を検知できない)
4. `latest/{uc_id}/stages/` を S1→S9 の順に存在チェック(S4/S5 は `attempt-{current_attempt}/` 内を
   tier ごとに。carry-forward done も有効な done として扱う)
5. 各 done の `manifest_sha256` を(再計算後の)input-manifest と照合 → 不一致は「stale」として該当 stage 以降を再実行対象に
6. status.yaml を done ファイル群 + events から再構築して上書き
7. **awaiting_review の分岐**: S9_review_generated.done.yaml があり `review_approved` イベントが無ければ、
   stage 実行ではなく「プレビュー再表示 + 承認対話」から再開する。`review_rejected` があれば
   その payload の差し戻し先 stage から再開する
8. 未完了の最初の stage から再開。中間生成物は削除しない

## 書き込み権限(write-set)の正本

| 書き手 | 書いてよい場所 |
|---|---|
| オーケストレータ(dist-impl-run) | events/ への追記、latest/ 直下の共有ファイル(config/uc-map/lock/lease)、`bootstrap.done.yaml` の Phase invalidate、status.yaml、`{uc_id}/input-manifest.yaml`、`S1_uc-init.done.yaml`、`S3_contracts.done.yaml`、carry-forward done の生成、`invalidated/` への done 退避、**workspace 依存追加(package.json / package-lock.json — attempt 開始時の単一 writer install、独立 commit)**、`review/review-notes.md`、git commit |
| S0 bootstrap | 実装リポ全体(初期生成)、latest/ の config/uc-map/lock、`bootstrap.done.yaml` |
| S4 Implementer(tier 別) | 自 tier の dir 配下、`attempt-{n}/S4_*.{自tier}.done.yaml`、issues/ |
| S5 Verifier(tier 別) | `attempt-{n}/S5_*.{自tier}.done.yaml`、`.findings.yaml` のみ(**実装コードの修正禁止**) |
| S6/S7 integration writer(直列) | `features/uc/`、`features/atdd/`(uc タグ付与を含む)、integration 用 step definitions、`S6/S7 done` |
| S8 feedback | issues/ の読取、change-requests/、learnings/、`S8_feedback.done.yaml` |
| S9 review | review/index.html、`S9_review_generated.done.yaml` |

**git 操作はオーケストレータのみ**。サブエージェントは git を実行してはならない(Bash 含む)。

**run-lease.yaml は commit しない**(一時ファイル。どの stage の write-set にも含まれない)。
`git add` のパスは**その stage の write-set に含まれる各パスを明示指定**する(`docs/impl/latest`
のような親ディレクトリの丸ごと指定は lease を巻き込むため不可)。または `.gitignore` に
`run-lease.yaml` を追加する。
