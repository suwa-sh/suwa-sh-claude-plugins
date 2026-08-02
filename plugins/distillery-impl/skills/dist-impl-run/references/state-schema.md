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
          S5_ui-review.{tier_id}.done.yaml        # 並走レーン。dispatch 条件を満たす frontend tier のみ
          S5_ui-review.{tier_id}.findings.yaml
          ui-artifacts/{tier_id}/                 # UI Reviewer が永続化する capture_review のキャプチャ・
                                                   #   SSR 静的 HTML 等(write-set に含む。複数 frontend tier の
                                                   #   並列実行での衝突を tier_id で防ぐ)
          ui-artifacts/{tier_id}/render/           # capture_review の SSR 静的 HTML 生成先(D11)
          ui-artifacts/{tier_id}/staging/          # capture_review 復旧再実行(D10 round2)の一時領域。
                                                    #   capture_review_completed イベント確定後に
                                                    #   オーケストレータが canonical へ昇格し空にする。
                                                    #   残存時は対応イベントの有無で扱いが分かれる
                                                    #   (D8 round3): イベント無し→orphan(破棄・
                                                    #   再実行)、イベント有り→冪等再遂行(「再開手順」
                                                    #   「冪等再遂行」参照)
        S6_uc-bdd.done.yaml
        S7_atdd.done.yaml
        S8_feedback.done.yaml
        S9_review_generated.done.yaml   # HTML 生成の完了(承認は含まない)
      invalidated/{event_id}/         # 無効化した done の退避先(stage_invalidated と対)
      issues/{ts}_{slug}.md
      feedback/as-built-summary.md     # S8が要求を書く前に生成する実装事実。handoff入力ではない
      feedback/draft.md                # S8 initial/refreshの単一mutable draft。publish時に移動
      feedback-requests/{feedback_id}.md # S9実装承認後に公開するimmutableなdist-pipeline入力
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
      bootstrap_completed | feedback_request_publish_started | feedback_request_published |
      capture_review_completed
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
該当 done を無効化 / `config_confirmed`（payload: 確定項目のbefore→after・confirmed_by）→
impl-config.yaml / uc-map.yamlの該当項目を確定値で上書き。**`after: null` はフィールド削除として
適用する**(例: ui_screens の非空化イベントは `ui_screen_resolution: {before: ..., after: null}` を
併記し、replay 後も XOR 制約が保たれるようにする)/ `review_approved` → 参照先S9 eventと
`feedback_review_evidence`および`implementation_review_evidence`が一致する場合だけ、request 0件なら`completed`、1件以上なら
`publishing_feedback`へ進む。

`feedback_request_publish_started`（stage: `S8`、payload: feedback_id / path / input_sha256 /
request_count / blocker_count / supersedes / review_approved_event_id / review_evidence_event_id）→
承認済みdraftのimmutable公開を予約する。request/blocker件数は承認済みexact bytesから再計算し、mutableな
S8 doneの旧集計を信頼しない。次にdraftを公開先へatomic renameし、
`feedback_request_published`（同じidentity + review lineage + published_at）→ blocker 0なら`completed`、1件以上なら
`blocked_on_spec`へ進む。reviewerや承認時刻はfeedback fileへ転記しない。`latest/`と食い違ったらeventsが正。

**done の退避(invalidate)**: review_rejected・stale 検知などで done を無効化するときは、
オーケストレータが**先に `stage_invalidated` イベント(payload: 対象 done 一覧・退避先)を追記し、
その後に** `latest/{uc_id}/invalidated/{event_id}/` へ該当 done を移動する
(「イベント追記 → latest 更新」の順序原則と同じ。削除しない。この移動はオーケストレータの write-set に含まれる)。

**補正 invalidation**: 先行の `stage_invalidated` イベントが宣言した退避を、実際の done 移動が
伴わないまま記録だけ残してしまった等の理由で後から完遂させる場合は、`corrects_event_id`
(補正対象の先行 `stage_invalidated` の event_id)を payload に持つ新しい `stage_invalidated`
イベントを追記する。reducer はこれを「先行 invalidation の `archived_to` を補正し、
payload の done 一覧を退避先へ移す」ものとして適用する(先行イベント自体は書き換えない。
イベントは追記のみで、事実の訂正は新しいイベントで行う既存の規約と同型)。

`stage_invalidated` の `invalidated_stages` に `S5` が含まれる場合、`S5_ui-review` の
done(存在すれば)も退避対象に含める(verify と同一 attempt スコープで扱う)。

`corrects_event_id` は `stage_invalidated` を補正対象とする用法(上記)に限らない。
下記「冪等再遂行」のとおり、`capture_review_completed` の昇格が再遂行不能なときも、
その `capture_review_completed` の event_id を `corrects_event_id` に持つ新しい
`stage_invalidated`(`invalidated_stages: [S5]`)を追記することで、その promotion の効果を
無効と宣言し S5 を元状態(`skipped(runtime_unavailable)`)へ戻す(同じ「先行イベントは
書き換えず、事実の訂正は新しいイベントで行う」原則の別適用)。

**`capture_review_completed`**(stage: `S5`、payload:
`{uc_id, tier, attempt, checks_checked_after, findings_sha256, captures_manifest_sha256,
staged_to_canonical: [{staged_path, canonical_path, sha256}]}`)は、
`checks_checked.capture_review: skipped(runtime_unavailable)` だった S5 ui-review の
capture_review だけを再実行して done/findings/captures を更新したことを示す専用イベント
(D10。既存の `stage_completed` は流用しない — dom_snapshot を含む全体の完了とは意味が異なるため)。
`checks_checked_after` は更新後の `checks_checked` の**全文**(dom_snapshot 分を含む)であり、
reducer がこれをそのまま done の `checks_checked` に適用できるようにする。`findings_sha256` /
`captures_manifest_sha256` は**昇格後**(canonical マージ後)の値で、**下記の昇格前検証を通過した
候補からのみ算出する**(sha 自己整合だけを根拠にしない)。`captures_manifest_sha256` の
canonicalization は `ui_imported.tree_hash` と同方式(captures[] の screenshot path を昇順に
`{path}\n{sha256}\n` 連結した文字列の sha256)。`staged_to_canonical` は
`attempt-{n}/ui-artifacts/{tier_id}/staging/` から `ui-artifacts/{tier_id}/` への移動対応表
(昇格の実施記録であり、再開時の orphan 検出の根拠になる)。

**UI Reviewer は canonical latest/ を直接更新しない**(D10 round2。当初案は UI Reviewer が
`findings.yaml`/`captures[]`/証跡画像を直接 write-set に書き、done の `checks_checked` 更新だけを
オーケストレータに委ねる設計だったが、成果物確定の証跡が不足するため staging 昇格方式に変更する):
UI Reviewer は capture_review の成果物(画像・SSR 静的 HTML・captures[] 追記分・findings 追記分)を
`attempt-{n}/ui-artifacts/{tier_id}/staging/` にのみ書き、`checks_checked_after`(全文)・
staged ファイルの `[{staged_path, sha256, canonical_path}]`・`findings-delta.yaml` の sha256 を
完了報告で返す(canonical な done/findings/`ui-artifacts/{tier_id}/`(`staging/` を除く)には
一切触れない)。

**昇格前検証(D8 round3。イベント追記の前に実施)**: オーケストレータは報告値を `staging/` の
実測(sha256)と照合するだけでなく、`staging/` の内容(既存 canonical `.findings.yaml` の
dom_snapshot 分 + `findings-delta.yaml` の capture_review 追記分)から**「マージ後 findings 候補」を
メモリ上に構築**し、**通常の S5 受理と同じ全検証**を実施する: (i) 候補の `checks_checked` が
`checks_checked_after` と完全一致すること、(ii) 候補の `captures[].target` が dispatch した
executable target 集合と 1:1 対応すること(欠落・重複・過剰なし。上記「captures[] の網羅性検証」と
同一規則)、(iii) capture_review の finding が `0 <= capture_index < captures.length` かつ
参照先 `captures[capture_index].result: diff` であること。**全検証が pass した候補についてのみ**
`findings_sha256`・`captures_manifest_sha256` を算出し、`capture_review_completed` イベントの
payload に記録する(検証に失敗した候補の hash はイベントに記録しない・昇格しない — stage failed
として報告し、`staging/` は orphan として残す。次回再開時に前回の再実行からやり直す)。

検証を通過したら、**まず `capture_review_completed` イベント(payload に staged→canonical 対応表・
検証済み候補の hash を含む)を追記し、その後に** 次を行う(すべてオーケストレータの write-set):
(a) `staging/` 配下のファイルを対応表どおり `ui-artifacts/{tier_id}/` 直下へ移動する、
(b) `findings-delta.yaml` の内容(検証済みのマージ後候補)を canonical `.findings.yaml` に反映する、
(c) done の `checks_checked` を `checks_checked_after` で更新する。**イベント先行**(冒頭の
「イベントを `events/` に追記してから `latest/` を更新する」原則どおり — 既存 done/findings/
ui-artifacts を in-place で更新するミューテーションであり、`stage_invalidated` が先にイベントを
追記してから done を退避するのと同型で扱う)。

**orphan 検出**: 再開時、`attempt-{n}/ui-artifacts/{tier_id}/staging/` が存在するのに対応する
`capture_review_completed` イベントが無い(前回の再実行が昇格未完了のまま中断した、または
昇格前検証で拒否された)場合、`staging/` を破棄して capture_review を再実行する(部分適用状態を
latest に持ち込まない。昇格成功後は `staging/` を空にするため、非空の `staging/` は昇格未完了の
証跡になる)。

**冪等再遂行**: `capture_review_completed` イベントは存在するが canonical(`.findings.yaml`・
`ui-artifacts/{tier_id}/`・done の `checks_checked`)が payload の期待 hash に達していない
(昇格の途中でオーケストレータが中断した)場合、`staging/` を orphan として破棄しない。
payload の `staged_to_canonical` を項目ごとに検査し、**「staged または canonical のどちらかに
同一 hash で存在する」ことを確認しながら冪等に昇格を再遂行**する(未移動の項目だけを移動する。
両方に存在し hash も一致していれば何もしない)。findings/done も payload の
`findings_sha256`・`captures_manifest_sha256`・`checks_checked_after` が指す期待状態まで
再適用する。**再遂行不能**(対応する staged_path・canonical_path のどちらにも該当ファイルが
無い、または存在しても hash が一致しない)な場合は、`stage_invalidated`(`corrects_event_id` に
当該 `capture_review_completed` の event_id を持つ補正)を追記して S5 を元状態(`skipped
(runtime_unavailable)`)へ戻す(部分昇格状態のまま latest に残さない)。

reducer は payload の `checks_checked_after` から done の `checks_checked` を再構築し、
`findings_sha256`・`captures_manifest_sha256` を昇格後の現物と照合して検証する(不一致で
再遂行も不能なら、上記の補正 `stage_invalidated` が適用されるまで latest 不整合として扱う)。

**S8 refresh**（S9承認対話の指摘反映。`review_approved`の**前**に実行する）は
`stage_completed`(stage: S8、payload: `{mode: refresh, refreshed_at, updated: N, added: M,
removed: K}`)を追記し、`S8_feedback.done.yaml` に `refreshed_at` と更新後件数を追記する
(done の作り直しはしない。latest はこの payload から再構築可能)。request 0件になった場合は、このeventを
先に記録してから未公開の`feedback/draft.md`だけを削除し、doneの`draft_path: null`とする。

**S9 review evidence**: S9 doneと対応する`stage_completed` eventは、HTMLへ表示したdraftの
`feedback_review_evidence: {feedback_id, draft_sha256, request_count}`を持つ。draftがない場合は
`{feedback_id: null, draft_sha256: null, request_count: 0}`とする。done/event間でexact一致しなければ
レビュー資料を有効にしない。さらに、表示したHTMLのexact bytesと実装判断の集約を
`implementation_review_evidence: {review_html_sha256, gate_result, open_blocker_count,
open_major_count, captures_sha256}`へ記録する。`captures_sha256`は`captures[]`の全画像
（`{path, sha256}`の配列）をcanonical JSON化したsha256で、captureが無い場合は`null`とする
（S9生成後の画像置換・欠損で証跡と承認が分離する穴を塞ぐ。plan round3 反映事項）。
S9 done / S9 event / current HTMLでこのmappingが一致しなければレビュー資料を有効にしない。

**実装承認の正は `review_approved` event**（S9 doneはHTML生成済みまで）。承認eventはpayloadに
`review_evidence_event_id`と、その参照先S9 eventとexact一致する`feedback_review_evidence`および
`implementation_review_evidence`を持つ。承認直前のdraft identity/hash/count、review HTML SHA、
gate/open finding集約とも一致しなければeventを追記せず、S8 refresh → S9再生成 →
再レビューへ戻る。S9_review_generated.done.yamlがあり、validな`review_approved`が無ければ`awaiting_review`。
同じreview evidenceを参照するapprovalは高々1件で、S9 eventより後のevent IDを持つ。validなapprovalが
既にあれば再利用する。再レビューで新しいS9 evidenceを作った場合は旧approvalを履歴として残し、最新S9
evidenceを参照するapprovalだけをcurrentとする。同じevidenceへの重複approvalは自動選択せず停止する。
`review_rejected` イベントは payload に差し戻し先 stage を持ち、該当 stage 以降の done を退避して再実行する。

**publishの再開**: `feedback_request_publish_started`だけがある場合、started eventが参照するapprovalと
S9 evidenceのlineage、両review evidence、feedback identity/count/SHAを再検証する。draftと公開先は
canonical UC rootから固定導出し、全親componentがdirectory/non-symlinkでrealpath containmentを満たすこと、
本体がregular/non-symlink、draftと公開先親がsame-filesystemであることを毎回`lstat`/`realpath`で確認する。
draftがあれば承認済みSHAとの一致とrename直前のdevice/inode/size再照合後にatomic renameを続行する。
draftが無く公開先があれば公開先をno-followで開いてSHAを検証し、`feedback_request_published`を追記する。
両方無い、両方ある、SHAが違う場合は停止する。published eventがあれば承認対話やpublishへ戻らない。
publish started/publishedはfeedback versionごとに各高々1件とし、event ID順を
S9 review evidence < approval < publish started < publishedに固定する。published eventからのno-opは、
canonical公開pathの親component containmentとregular/non-symlinkが成立し、記録SHA/ID/count/review lineageと
exact一致する場合だけ許す。別path、
欠落、改変、重複・競合eventは上書きや再publishで修復せず停止する。

**公開後の訂正**: 公開Markdownは編集しない。新feedback IDのdraftを作り、front matterの`supersedes`で
旧IDを示す。新しいS9レビュー承認とpublish eventを記録し、旧file/eventを残す。

## impl-config.yaml

```yaml
schema_version: "1.0"
specs_root: "docs"                     # distillery 出力のルート(docs/specs, docs/arch, ...)
repo_root: "impl"                      # 実装先リポのルート(相対 or 絶対)
tiers:                                 # 実装 tier の宣言(architecture tier と別概念)
  - id: tier-frontend
    dir: frontend
    kind: frontend                     # frontend | backend | worker | data-pipeline | cli | mcp-server。
                                       # read-set 分岐・tier-rules 適用の機械可読キー
    lang: typescript                   # (tier id からの推測はしない。P2 でユーザー確認して確定する必須項目)
    commands:
      format_check: "..."
      lint: "..."
      test: "..."
      bdd: "..."
    capabilities:                      # frontend tier のみ。P1 preflight_evidence から P2 でユーザー確認して確定(D7)
      ui_review: {dom_snapshot: true, capture_review: enabled}   # dom_snapshot は bool(決定論・CI 常設)、
                                       #   capture_review は enabled|disabled(方針の宣言。実施可否はセッション
                                       #   依存のため P1 では probe せず S5 実行時に判定 — D10)。独立フラグ
                                       #   (capture_review は dom_snapshot の SSR 能力を前提にしない)
  - id: tier-backend-api
    dir: backend-api
    kind: backend
    lang: typescript
    commands: {format_check: "...", lint: "...", test: "...", bdd: "..."}
datastore_owner: tier-backend-api      # migration/schema 資産の既定所有 tier
                                       # (contracts[] で provider が宣言された資産はその tier が所有)
contracts:                             # 契約宣言(正本。種別定義は
                                       #  ../../dist-impl-bootstrap/references/contract-registry.md)
  - id: api                            # 契約 id(lock・S3 検証・contracts/ 出力のキー)
    type: openapi                      # レジストリに定義された種別のみ
    source: "specs/latest/_cross-cutting/api/openapi.yaml"   # specs_root 相対
    provider: tier-backend-api         # 契約面を実装・所有する tier
    consumers: [tier-frontend]         # 契約面に依存する tier
  - id: mart-tables                    # 例: data pipeline の mart を backend が read model として読む
    type: rdb-schema
    source: "specs/latest/_cross-cutting/datastore/rdb-schema.yaml"
    scope: ["loan_stats"]              # 種別により任意。対象テーブル名の完全一致の配列
                                       # (glob・正規表現は不可。照合規則は contract-registry.md)
    provider: tier-data-pipeline
    consumers: [tier-backend-api]
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
- **contracts[] は tier 間依存面の正**。P2 が推論案を出しユーザー確認で確定する
  (`config_confirmed` イベント)。capabilities の has_* は probe 結果の記録であり契約の正ではない。
  P4 の codegen・S3 の検証・S4 の read-set 配布はすべてこの宣言を loop する(種別名で分岐しない)
- **`tiers[].capabilities.ui_review` はトップレベルの `capabilities`(bootstrap の存在プローブ結果)とは
  別概念**: トップレベルはリポ全体の has_* フラグ、`tiers[].capabilities.ui_review` は
  frontend tier ごとの UI 並走レビュー能力(`{dom_snapshot: bool, capture_review: enabled|disabled}`)。
  P1 は raw evidence を `bootstrap.done.yaml` の `preflight_evidence.ui_review` に記録するのみで
  判定しない(実装 tier の確定は P2 のため)。**capture_review の実施可否(browser ツールが
  使えるか)はセッション依存のため P1 では probe せず、方針(実施したいか)だけを P2 で確定する。
  実際に使えるかは S5 実行時に UI Reviewer が判定する**(D10)。**P2 が tier ごとに方針を確定**し、
  `config_confirmed` イベントで `tiers[].capabilities.ui_review` を書く(D7・D10)

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
    ui_screens: []                     # has_design_system かつ frontend tier を持つ場合のみ。
                                       #   design-event.yaml の screens[] のうち本 UC に uc 名一致した
                                       #   screen の {name, route} の配列(S1 が確定・永続化。
                                       #   screen name は一意制約が無いため route で行の同定を補う。
                                       #   同名 UC が複数ある場合・帰属曖昧時はユーザー確認の上で確定。
                                       #   tier-rules.md の read-set 解決の起点)
    ui_screen_resolution: plain_ui_confirmed  # plain_ui_confirmed | feedback_requested。
                                       #   ui_screens が 0 件の場合の合意記録(S1 が確定・永続化)。
                                       #   **ui_screens と XOR**: ui_screens が非空ならこのフィールドは
                                       #   置かない(design 更新後の再実行で ui_screens が非空になったら
                                       #   S1 が残存値を削除する)。0 件の場合のみ記録する
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
schema_version: "1.1"
contracts:                             # impl-config の contracts[] と同じ id をキーにする
  - id: api
    type: openapi
    source_read: none                  # 契約 source の読み取り可否: none | scope | full
    input: {path: "docs/specs/latest/_cross-cutting/api/openapi.yaml", sha256: "..."}
    generated:
      - {dir: "packages/contracts/api-types", generator: "typescript-fetch", audience: both, at: "..."}
      - {dir: "packages/contracts/api-client", generator: "typescript-fetch", audience: consumers, at: "..."}
      - {dir: "packages/contracts/server-stubs", generator: "typescript-node", audience: provider, at: "..."}
  - id: mart-tables
    type: rdb-schema
    scope: ["loan_stats"]
    source_read: scope
    input: {path: "docs/specs/latest/_cross-cutting/datastore/rdb-schema.yaml", sha256: "..."}
    generated:
      - {dir: "packages/contracts/mart-tables", generator: "direct-from-yaml", audience: both, at: "..."}
generated_at: "..."
```

lock は実装リポ側エージェントの**機械可読 read-set** を兼ねる(P4 が registry の read-set
スロットから反映する。Implementer / Verifier は registry を読まない):

- `generated[].audience: provider | consumers | both` — 配布先 role。S4/S5 は
  「自 tier の role または both の generated[] のみ」を読む。**generated[] に `lang` がある場合
  (複数言語生成時)は、自 tier の lang と一致するエントリのみ**
- `source_read: none | scope | full` — 契約 source を読んでよいか。none(例 openapi —
  生成物起点)は source を読まない。scope は contracts[] の scope 範囲のみ。full は全量

S3 で契約ごとに input の sha256 を照合し、不一致なら該当契約の再生成のみ実行して lock を更新する。
照合とは独立に、種別ごとの verify(正本は
`../../dist-impl-bootstrap/references/contract-registry.md`)を当該 UC の範囲で実行し、
結果を S3 done に記録する(lock には書かない — verify は UC 単位、lock はグローバル)。

**旧形式からの移行**: schema_version "1.0" の lock(トップレベル `inputs:`)や、bootstrap.done.yaml の
旧キー(`inputs_sha256.openapi` / `.asyncapi`)を検出したら、P4 を invalidate して新形式で再生成する
(生成物の内容が同じでも形式移行として 1 回だけ再生成する)。既存の impl-config に `contracts[]` が
無い場合は P2 を invalidate し、契約宣言案の確認からやり直す。

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
  contracts:                           # impl-config の contracts[] の id ごとの入力ハッシュ
    api: "..."
    mart-tables: "..."
  contracts_decl: "..."                # contracts[] 宣言自体の canonical JSON sha256
                                       # (source の内容が同じでも scope / provider / consumers の
                                       #  変更で P4 を invalidate するため)
preflight_evidence:                    # P1 の raw evidence(判定はしない。P2 が tiers[].capabilities.ui_review
                                       #  の方針確定の材料に使う。存在するのは frontend 種別の tier があり
                                       #  ui_review probe を実行したリポのみ)
  ui_review:
    ssr_renderer: {detected: true, path: "node_modules/react-dom/package.json"}   # SSR renderer の存在
    storybook_build: {detected: true, path: "storybook-app/.storybook"}           # Storybook build 構成の存在
    # browser 系ツール(Claude in Chrome 等)はセッション依存のため probe しない・記録しない(D10)。
    # capture_review の実施可否は S5 実行時に UI Reviewer が判定する
migrations:                            # 一度きりの移行実施記録(旧形式検出 → invalidate の再発防止マーカー)
  ui_review_v1: {at: "..."}            # 存在すれば tiers[].capabilities.ui_review 移行は実施済み
                                       #   (has_design_system: false のリポでは記録しない — 移行対象外)
generated_at: "..."
generated_by: "distillery-impl@{plugin_version}"  # provenance。version は plugin.json から実行時に読む(例をリテラル転記しない)
```

- **S0 の完了判定は「全 Phase done/skipped」+「入力ハッシュの現物一致」の両方**。
  オーケストレータは起動時に inputs_sha256 の各入力を現物から再計算し、
  不一致の入力に依存する Phase を invalidate する(bootstrap.done.yaml の Phase 記録の
  書き換えはオーケストレータの write-set に含まれる)。依存表:
  spec_event/arch → P2 以降すべて / usdm → P7 / design → P5 / design_storybook_src → P5 /
  contracts.{id}(契約入力)・contracts_decl(宣言変更)→ P4 /
  **条件付き入力(契約 source / kvs / object-storage / storybook-app)の存在自体の増減 →
  P1・P2(capability・契約宣言と config の再判定)+ 対応する生成 Phase**。
  invalidate された Phase は bootstrap 再実行の対象になる
- inputs_sha256 には spec_event / arch / usdm / design と contracts[] の各入力(存在するもの)に加え、
  条件付き入力の**存在フラグ**(exists: true/false)を記録する(欠落 → 出現も検知するため)
- bootstrap 再実行時は本ファイルの Phase 記録(invalidate 反映後)で skip を決める(冪等)
- **旧形式(ui_review 未対応)からの移行**: **`has_design_system: true` かつ** frontend 種別の tier が
  あるのに `tiers[].capabilities.ui_review` または `preflight_evidence.ui_review` が欠落しており、
  **かつ `migrations.ui_review_v1` が未記録**の場合に限り、P1・P2 を一度だけ invalidate して
  probe とユーザー確認をやり直す(contracts[] 欠落時の P2 invalidate と同型。D7)。移行完了時に
  `migrations.ui_review_v1: {at: ...}` を記録し、以後は再判定しない(一度きりの根拠。
  `dom_snapshot: false` かつ `capture_review: disabled` を選んでも `tiers[].capabilities.ui_review`
  フィールド自体は書かれるため、通常はこのマーカーが無くても欠落検出に再該当しないが、
  マーカーで再判定条件を明示的に閉じる)。
  **`has_design_system: false` のリポは移行対象外**(dom_snapshot/capture_review 自体が
  該当しないため `preflight_evidence.ui_review` を probe しない。マーカーも記録しない)

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
  contracts_decl: {sha256: "..."}      # impl-config の contracts[] を canonical JSON 化した sha256
                                       #   (scope / provider / consumers / source の宣言変更を検知する。
                                       #    stale 適用は S3 以降)
  contracts_lock: {path: "docs/impl/latest/contracts.lock.yaml", sha256: "..."}   # 契約生成物の版
                                       # ※ contracts_lock の変化による stale 判定は S4 以降にのみ適用する
                                       #   (S3 が lock を正当に更新した直後に S1/S2 が巻き戻るのを防ぐ。
                                       #    S3 は lock 更新後にこのエントリを更新する)
  ui_review_config: {sha256: "..."}    # 全 frontend tier の {tier_id, capabilities.ui_review}
                                       #   ({dom_snapshot, capture_review} の方針)を canonical JSON 化
                                       #   (キー昇順・UTF-8・null は明示)した sha256。
                                       #   ※ stale 判定は S2 以降にのみ適用する(S1 done は projection で除外
                                       #     — contracts_decl / contracts_lock と同じ方式。D7)
  ui_imported: {tree_hash: "..."}      # has_design_system のみ。packages/ui/ 配下の実体合成 tree hash
                                       #   (`.imported.yaml` の per-file sha256 だけでは取り込み後の
                                       #    story 実体改変を検知できないため、実体から都度計算する)
  ui_screen_config: {sha256: "..."}    # has_design_system かつ frontend tier を持つ UC のみ。
                                       #   uc-map の {ui_screens, ui_screen_resolution} を canonical JSON 化
                                       #   (キー昇順・UTF-8・null は明示)した sha256。screen 解決の変更を
                                       #   stale 判定に乗せる(S1 は screen 解決の確定後に manifest を確定する)
  dev_rules_sha256: "..."              # docs/dev-rules/ の全ファイルを path 昇順に
                                       #   `{path}\n{sha256}\n` 連結した文字列の sha256
                                       #   (path は docs/dev-rules/ 相対。ui_imported と同じ
                                       #    canonical serialization)
lineage_ok: true                       # spec-event の trigger_event と arch/design の event_id 整合
```

**`ui_imported.tree_hash` の計算規則(canonical serialization。S1 が実体から計算する)**:

1. `packages/ui/` 配下の**実ファイルを走査して列挙**する(`.imported.yaml` 自身は除外)
2. 実ファイル集合と `.imported.yaml` の `files[].path` 集合を **exact 比較**(過不足いずれも乖離)
3. path 昇順に `{path}\n{sha256}\n` を連結した文字列の sha256 を tree hash とする
   (path をハッシュ対象に含めるため、改名・追加・削除・内容変更のすべてで hash が変わる)

**fail-closed**: 手順 2 の乖離(実ファイルと `.imported.yaml` の path 集合の不一致)・per-file sha256
の不一致は、S1 の input-preflight で「取り込みの再実行 or 変更内容の確認」として提示する
(推測で吸収しない)。

- **latest 同士の系譜不整合は実在する**(サンプルでも spec の trigger より arch latest が新しい)。
  `lineage_ok: false` の場合は停止し、「spec を再生成するか / 旧 arch 前提で進めるか」をユーザーに問う
- 各 `.done.yaml` は `manifest_sha256` を持つ。再開時に現在の manifest と比較し、
  **不一致なら該当 stage 以降の done を無効扱い**にする(ファイルは消さず退避)
- **manifest_sha256 は stage projection で計算する**: 各エントリの「stale 適用は Sx 以降」の記述に従い、
  その stage 未満の done では該当エントリを除外したハッシュを使う。**S1 の done は `contracts_decl` /
  `contracts_lock` / `ui_review_config` の 3 エントリを除外**した manifest のハッシュ、
  **S2 の done は `contracts_decl` / `contracts_lock` の 2 エントリを除外**した manifest のハッシュ
  (`ui_review_config` は S2 から適用のため含める)、**S3 以降の done は manifest 全体**の
  ハッシュを持つ。これにより「contracts_lock の変化は S4 以降にのみ適用」「contracts_decl の変化は
  S3 以降にのみ適用」「ui_review_config の変化は S2 以降にのみ適用」の例外が照合アルゴリズムとして
  成立する(全体ハッシュ 1 本だと、S3 の正当な lock 更新で S1/S2 の done まで stale になり巻き戻る)

## status.yaml({uc_id} 配下・スナップショット)

```yaml
schema_version: "1.0"
uc_id: "3f9a2b1c"
business: "貸出管理業務"
buc: "貸出管理フロー"
uc: "書籍を貸出する"
state: running | blocked_on_spec | awaiting_review | publishing_feedback | completed | invalidated
                                       # invalidated = stage_invalidated で done が退避され再実行待ち
                                       #   (入力変更・規範変更等。再開時は S1 から新 manifest で再生成)
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
  S5_ui_review:                        # dispatch 条件を満たす frontend tier のみキーを持つ(D8)
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
completed_by: "dist-impl-implement@{plugin_version}"   # 書いた skill 名 + plugin version(provenance)。
                              # version は ${CLAUDE_PLUGIN_ROOT}/.claude-plugin/plugin.json の
                              # version を実行時に読む(SKILL.md への埋め込みはしない — 正本は plugin.json のみ)
```

S3 done は `contracts_verified: [{id, result: pass | degraded_continue, detail: "..."}]` を持つ
(契約ごとの実装時検証の結果。縮退続行はユーザー判断の記録を detail に含める。
検証を行ってから S4 を dispatch する gate の証跡)。

**S5 UI Reviewer done は `checks_checked`(findings スキーマと同形の全文)と `dispatch_targets:
{hash, count}` を持つ**(D8 round2)。**通常実行時(`checks` 省略の全 check dispatch)は done の
`checks_checked` が `.findings.yaml` の `checks_checked` と完全一致すること**をオーケストレータの
S5 受理条件に加える(不一致なら stage failed 扱い)。

**dispatch target の canonical hash**(`dispatch_targets.hash` / `targets_hash` 引数の計算規則。
D8 round2): 各 target 記述(`{screen: {name, route}, story, variant}`)を key 昇順 canonical JSON 化し、
`(screen.name, screen.route, story, variant)` のタプルで辞書順ソートしたのち、各行を
`{canonical_json}\n` で連結した文字列の sha256(`ui_imported.tree_hash` と同型の
「ソート→連結→ハッシュ」方式)。オーケストレータは S5 dispatch 時にこの hash と件数
(`targets_count`)を算出して UI Reviewer へ渡し(subagent-template.md)、UI Reviewer は受け取った
値をそのまま done の `dispatch_targets` に転記する。**オーケストレータは S5 受理時に独立して
再計算し、`dispatch_targets` と一致することを検証する**(不一致なら stage failed。渡した targets
と UI Reviewer が実際に処理した targets の取り違えを防ぐ)。**`captures[].target`(dist-impl-ui-review
の findings スキーマ)は dispatch target と同型 `{screen: {name, route}, story, variant}` を持ち、
この canonicalization(key 昇順 canonical JSON 化・重複判定)を**同一規則**として使う**(射影
比較ではなく完全一致比較が成立するように。D8 round3)。

**captures[] の網羅性検証(fail-closed。D8 round2)**: `checks_checked.capture_review.status: done`
の場合、オーケストレータは **S5 受理時と S9 の両方**で「`captures[].target` と dispatch した
executable target 集合が(上記と同一の canonicalization 規則で)1:1 対応すること(欠落・重複・
過剰なし)」を検証する。不一致なら S5 受理/S9 完了のどちらも行わない。さらに、capture_review の
finding は `0 <= capture_index < captures.length` かつ `captures[capture_index].result: diff` で
あることを検証する(範囲外・存在しない添字・`match`/`skipped` への参照は不正な finding として
拒否する)。

**S5 UI Reviewer done は共通スキーマの `result` を `pass | environment_failure | unverified` の
union として使う**(D8。正本は `dist-impl-ui-review/SKILL.md`)。`environment_failure` は
**dom_snapshot 側のみ**が到達する状態(検証環境自体が壊れている場合)で、一次根拠を構造化した
`environment_failure: {check, command, exit_code, evidence}` と、capability の更新案のみを持つ
`degradation_proposed`(例 `{tier-frontend: {dom_snapshot: false}}`。失敗理由・証跡は書かない)を
必須で伴う。findings には書かない(findings は仕様・実装の問題、done は stage 実行結果の置き場
として分離する)。**capture_review はこの union に到達しない**: browser ツールが利用不能な場合は
`checks_checked.capture_review: {status: skipped, reason: runtime_unavailable}` として `result: pass`
のまま進める(D10。セッション依存のツール可否を環境失敗として扱わない設計)。
`unverified` は dispatch されたが executable target が実測 0 件等で検証が成立しなかった状態
(環境は正常。environment_failure とは原因が異なる)。**`result: pass` の場合のみ完了扱いとし、
`environment_failure` / `unverified` はいずれも未完了(S5 へ差し戻し)として扱う**
(再開手順の項参照)。`environment_failure` の縮退遷移(issues 起票・ユーザー確認・`config_confirmed`
による `tiers[].capabilities.ui_review` 更新・invalidate、または拒否時の `stage_failed` +
lease 解放)は `dist-impl-run/SKILL.md` の S5 手順を正本とする。`checks_checked.capture_review:
skipped(runtime_unavailable)` からの再実行規則(browser ツールが後で使えるようになった場合)も
同 SKILL.md の S5 手順(D10)を正本とする。

S9 doneはトップレベルに`feedback_request_count`と`open_blocker_count`、および表示したdraftを結ぶ
`feedback_review_evidence: {feedback_id, draft_sha256, request_count}`と、表示したHTMLと判断根拠を結ぶ
`implementation_review_evidence: {review_html_sha256, gate_result, open_blocker_count,
open_major_count, captures_sha256}`を持つ。
S8 initial/refreshのdoneは `feedback_request: {draft_path, request_count, blocker_count}`を持つ。
publish後は同じmappingへ`published_path`、`feedback_id`、`input_sha256`、`review_approved_event_id`、
`review_evidence_event_id`、`published_at`を追加し、
`draft_path: null`とする。reviewer情報やstage routeは持たない。

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
   tier ごとに。carry-forward done も有効な done として扱う)。**`S5_ui-review` の done は
   `result: pass` の場合のみ完了扱いする**: `environment_failure` / `unverified` は
   (done ファイル自体は存在していても)未完了として扱い、S5 へ差し戻す。
   `environment_failure` は縮退判断を含む `dist-impl-run/SKILL.md` の S5 手順に従う。
   **`unverified` は dispatch 条件・executable target を再算出した上で 2 分岐する**:
   - **再算出後も target が 0 件**: 既存の `unverified` done を `stage_invalidated` イベント
     (`corrects_event_id` は使わない通常の invalidate)経由で `invalidated/` へ退避し、
     その tier を `executable_target_zero` の非 dispatch 状態として扱う(以後の完了判定から
     除外する — dispatch 条件を満たさない tier と同じ扱いに合流させる。target 0 件が
     入力側の恒常的な状態であることが確定したため、再試行を繰り返さない)
   - **再算出後は target が 1 件以上**: 同一 attempt で UI Reviewer を再 dispatch する
     (attempt は進めない。前回の `unverified` は新しい done で上書きされる)
   **`result: pass` かつ `checks_checked.capture_review: {status: skipped, reason:
   runtime_unavailable}` の場合(D10)**: この done は完了扱いのまま S5 の完了判定は進めるが、
   次の条件をすべて満たすときに限り capture_review だけの再実行を行う: 現セッションで browser
   系ツールが利用可能、**かつ `S6_uc-bdd.done.yaml` 以降の done がまだ存在しない**(存在すれば
   再実行しない — その attempt は skipped のまま終端し、後続の変更・再実行サイクルで実施する。
   承認済み証跡の失効・再承認の複雑さを持ち込まないため)。再開時、`staging/` の状態を次の 2 通り
   に判定する(D8 round3): **(i) 対応イベントの無い `staging/`(orphan)を検出したら破棄**して
   ゼロから再実行、**(ii) `capture_review_completed` イベントは存在するが canonical が payload の
   期待 hash に未到達(前回の昇格が中断)なら「冪等再遂行」を行う**(上記「冪等再遂行」の項に
   従う。破棄しない — 検証済みで event が確定済みの内容を失わないため)。上記いずれにも
   該当しなければ、`checks=capture_review` を渡して UI Reviewer を同一 attempt で再 dispatch する。
   UI Reviewer は成果物を `staging/` にのみ書き、`checks_checked_after`(全文)・staged ファイル
   一覧・各ハッシュを完了報告で返す(canonical latest/ は書き換えない)。オーケストレータは
   報告値を `staging/` の実測と照合するだけでなく、**イベント追記の前に**上記「昇格前検証」
   (マージ後 findings 候補を構築し、通常の S5 受理と同じ全検証を実施)を行い、**全検証 pass の
   場合のみ**検証済み候補の hash で **`capture_review_completed` イベント(payload に
   staged→canonical 対応表を含む)を先に追記し、その後に** staging→canonical への昇格
   (ファイル移動・findings マージ・done の `checks_checked` 更新)を行う(イベント先行。
   dom_snapshot の記録・attempt カウンタには触れない。追加 findings に blocker があれば通常の
   attempt 制御に乗る — S6 前のため既存規則のまま)。**検証に失敗したらイベントを書かず**
   `staging/` を orphan のまま残す(次回再開時に (i) の規則で破棄され再実行される)
5. 各 done の `manifest_sha256` を(再計算後の)input-manifest と照合 → 不一致は「stale」として該当 stage 以降を再実行対象に
6. status.yaml を done ファイル群 + events から再構築して上書き
7. **S9以後の分岐**: S9 doneがありvalidな`review_approved`が無ければ「プレビュー再表示 + 実装承認対話」へ
   戻る。approvalのS9 event参照、done/event/approvalの両review evidence、current draft/HTML hashのどれかが
   不一致ならS8 refresh → S9再生成へ戻る。`review_rejected`があれば差し戻し先stageから再開する。
   validな`review_approved`がありrequest 1件以上で
   published eventが無ければ`dist-impl-feedback mode=publish`から再開する。publish started eventがあれば
   上記の再開規則でdraft/publicationのどちらを継続するか判定する。published eventがあれば
   blocker件数に応じて`completed`または`blocked_on_spec`へ復元する
8. 未完了の最初の stage から再開。中間生成物は削除しない

## 書き込み権限(write-set)の正本

| 書き手 | 書いてよい場所 |
|---|---|
| オーケストレータ(dist-impl-run) | events/ への追記、latest/ 直下の共有ファイル(config/uc-map/lock/lease)、`bootstrap.done.yaml` の Phase invalidate、status.yaml、`{uc_id}/input-manifest.yaml`、`S1_uc-init.done.yaml`、`S3_contracts.done.yaml`、**S3 の契約不整合の `issues/` 起票**、**S5 UI Review 環境失敗(`result: environment_failure`)の `issues/` 起票**、**`capture_review_completed` イベント追記後の staging→canonical 昇格**(`attempt-{n}/ui-artifacts/{tier_id}/staging/` から `ui-artifacts/{tier_id}/` へのファイル移動・`.findings.yaml` への findings-delta マージ・該当 `S5_ui-review.{tier_id}.done.yaml` の `checks_checked` 更新。D10 round2 skipped 復旧の再実行時のみ)、orphan 化した `staging/` の破棄、carry-forward done の生成、`invalidated/` への done 退避、**workspace 依存追加(package.json / package-lock.json — attempt 開始時の単一 writer install、独立 commit)**、`review/review-notes.md`、git commit |
| S0 bootstrap | 実装リポ全体(初期生成)、latest/ の config/uc-map/lock、`bootstrap.done.yaml` |
| S2 Implementer(test-scaffold) | 各 tier の `features/`・`test/`、`features/uc/`、`features/atdd/`、`S2_test-scaffold.done.yaml`、対象 UC の `issues/`(矛盾 3 条件の起票) |
| S4 Implementer(tier 別) | 自 tier の dir 配下、`attempt-{n}/S4_*.{自tier}.done.yaml`、issues/ |
| S5 Verifier(tier 別) | `attempt-{n}/S5_verify.{自tier}.done.yaml`、`.findings.yaml` のみ(**実装コードの修正禁止**) |
| S5 UI Reviewer(tier 別。dispatch 条件を満たす frontend tier のみ) | **通常 dispatch**: `attempt-{n}/S5_ui-review.{自tier}.done.yaml`、`.findings.yaml`、`attempt-{n}/ui-artifacts/{自tier}/`(capture_review の SSR 静的 HTML・キャプチャ画像を含む)のみ(**実装コードの修正禁止**)。**`checks=capture_review` の再実行時は例外**(D10 round2): `attempt-{n}/ui-artifacts/{自tier}/staging/` のみ。canonical な done・`.findings.yaml`・`ui-artifacts/{自tier}/`(`staging/` を除く)への書き込みは禁止(staging→canonical の昇格はオーケストレータが `capture_review_completed` イベント追記後に行う) |
| S6/S7 integration writer(直列) | `features/uc/`、`features/atdd/`(uc タグ付与を含む)、integration 用 step definitions、`S6/S7 done` |
| S8 feedback | issues/の読取、feedback/、feedback-requests/、learnings/、`S8_feedback.done.yaml`。publish時だけ`feedback_request_publish_started/published` eventを追記可 |
| S9 review | review/index.html、`S9_review_generated.done.yaml` |

**git 操作はオーケストレータのみ**。サブエージェントは git を実行してはならない(Bash 含む)。

**run-lease.yaml は commit しない**(一時ファイル。どの stage の write-set にも含まれない)。
`git add` のパスは**その stage の write-set に含まれる各パスを明示指定**する(`docs/impl/latest`
のような親ディレクトリの丸ごと指定は lease を巻き込むため不可)。または `.gitignore` に
`run-lease.yaml` を追加する。
