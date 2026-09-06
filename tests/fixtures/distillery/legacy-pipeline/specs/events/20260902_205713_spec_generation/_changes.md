# 変更内容（20260902_205713_spec_generation）

## feedback lineage

| 項目 | 値 |
|------|-----|
| feedback_request_id | `20260902_213000_impl_feedback_d0f57ea2` |
| input_sha256 | `ec85158bc13b54b63c3b96567bb1206417360ee13594fac713374fffa89c64fb` |
| request_ids | `CR-d0f57ea2-002`, `CR-d0f57ea2-006` |
| direct_work_unit_ids | `CR-d0f57ea2-002#1` |
| causal_work_unit_ids | `CR-d0f57ea2-002#1`, `CR-d0f57ea2-006#1` |
| stage packet | `docs/pipeline/feedback-runs/20260902_213000_impl_feedback_d0f57ea2/stage-packets/spec.md` |
| previous_event_id | `20260902_191046_spec_generation` |

CR 本文は `docs/pipeline/feedback-runs/20260902_213000_impl_feedback_d0f57ea2/input.md` の
該当 byte slice が正本であり、本イベントへ複製しない。

## CR-d0f57ea2-002#1（constraint_key: asyncapi-payload-title / direct owner: spec）— applied

### 判断

`_cross-cutting/api/asyncapi.yaml` の `components.schemas` は全スキーマが `title` を持ち、
全 message の `payload` / `headers` が `$ref` で名前付きスキーマを参照していた
（前イベント 20260902_191046_spec_generation で付与済み）。
一方、AsyncAPI を再集約する Step4a の入力である UC 単位の `_api-summary.yaml` は
`message_schema`（message 名）しか持たず、payload schema の安定 title がどこにも
アンカーされていなかった。この状態では UC 側の差分再生成で payload が
インライン定義へ戻り、生成型が匿名名（`AnonymousSchema_1`）へ退行しうる。
これを残存ギャップとして解消した。

### 変更

1. UC 単位 `_api-summary.yaml`（5 UC / 6 event）の `async_events[]` へ
   `payload_schema` と `headers_schema` を追加した。

   | UC | message | payload_schema |
   |----|---------|----------------|
   | 取置き通知メールを送信する | `HoldNoticeRequested`（requested / DLQ の 2 event） | `HoldNoticeRequestedPayload` |
   | リマインドメールを送信する | `RemindNotificationRequested` | `RemindNotificationRequestedPayload` |
   | 督促メールを送信する | `DunNotificationRequested` | `DunNotificationRequestedPayload` |
   | 在庫状況を区分別に集計する | `InventoryReportAggregationRequested` | `ReportAggregationRequestedPayload` |
   | 期間別貸出統計を集計する | `LoanStatsReportAggregationRequested` | `ReportAggregationRequestedPayload` |

   `headers_schema` は全 event 共通で `MessageHeaders`。

2. 非同期イベントを持つ tier 仕様 12 ファイル（`tier-backend-api.md` / `tier-worker.md`）の
   「非同期イベント」「イベント処理仕様」節へ、`- **ペイロードスキーマ**` と
   `- **ヘッダースキーマ**` の 2 行を追加した。payload schema 名が
   AsyncAPI の `components.schemas.{name}.title` と同名であること、
   業務的意味が変わらない限り改名しないことを明記した。

3. `_cross-cutting/api/uc-api-dependencies.md` へ
   「非同期メッセージの payload schema title 一覧」節を追加した。
   message ↔ channel ↔ `payload_schema`（= title）↔ `headers_schema` ↔ 所有 UC を
   1 表に固定し、`_api-summary.yaml` と AsyncAPI の突き合わせ先を 1 箇所にした。

`asyncapi.yaml` 自体は既に完了条件を満たしていたため変更していない
（`info.description` の命名規約が引き続き正本）。

## CR-d0f57ea2-006#1（constraint_key: loading-state-components / direct owner: design_system）— 波及確認のみ

direct owner の design_system ステージがイベント `20260902_204527_design_system` で applied 済み。
今回の design 側変更は `components.ui[]` への `path` / `exports` / `usage` 付与と
`LoadingState` の import 規約明記であり、デザイン資産内で完結する。

spec 側は前イベント 20260902_191046_spec_generation で
「loading 表現は `LoadingState` に一本化し、画面が `Skeleton` / `Spinner` を直接使わない」を
全 presentation tier 仕様（49 ファイル）へ反映済みで、今回の design 変更と矛盾しない。
したがって本イベントで spec 側の追加変更は不要（already_current）。

## RDRA 整合性

RDRA（`docs/rdra/latest/`）に無いアクター / 情報 / BUC / 画面 / エンティティは追加していない。
UC 数 41、業務 7、BUC 13 は変更なし。
