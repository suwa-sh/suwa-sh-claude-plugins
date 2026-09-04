design_available: true
event_id: 20260902_205713_spec_generation

# 推論根拠（feedback 差分実行 / 20260902_213000_impl_feedback_d0f57ea2）

## 実行モード

| 項目 | 値 |
|------|-----|
| mode | feedback（差分） |
| design_available | true |
| dialogue_policy | interactive |
| 処理対象 | packet の `allowed_work_unit_ids` のみ（UC 全量再生成なし） |

前段イベント: rdra=`20260902_130741_initial_build` /
arch=`20260902_144724_arch_infra_feedback_20260902_142349_infra_product_design` /
design=`20260902_204527_design_system`

## work unit の所有と波及

| work unit | constraint_key | direct owner | 本ステージの役割 |
|-----------|----------------|--------------|------------------|
| CR-d0f57ea2-002#1 | asyncapi-payload-title | spec（本ステージ） | direct owner として適用 |
| CR-d0f57ea2-006#1 | loading-state-components | design_system（applied 済） | causal（波及整合の確認） |

## CR-d0f57ea2-002#1 の分析

### 現状調査

| 調査対象 | 結果 |
|----------|------|
| `_cross-cutting/api/asyncapi.yaml` の `components.schemas` | 全 9 スキーマに `title` あり |
| message の `payload` / `headers` | 全 5 message が `$ref` 参照。インライン定義なし |
| payload 内のネスト構造 | オブジェクト・配列のインライン定義なし。enum は `$ref` |
| `info.description` の命名規約 | 記載済み（`{イベント名}Payload`） |
| UC 単位 `_api-summary.yaml` の `async_events[]` | **`message_schema` のみ。payload schema title のアンカーなし** |
| tier 仕様の非同期イベント節 | **message 名のみ。payload schema 名の記載なし** |

### 判断

完了条件「生成型が業務イベントを表す安定名を持ち、匿名 schema 名が残らない」は
契約ファイル単体では満たされている。しかし Step4a（API 統合）は UC 単位の
`_api-summary.yaml` を入力として asyncapi.yaml を再集約する設計であり、
入力側に payload schema title が無いままでは差分再生成のたびに
匿名スキーマへ退行するリスクが残る。design_system ステージが同一 request で
「component は存在するが名前から解決できない」という残存ギャップを解消したのと
同じ構図と判断し、UC 単位の中間成果物と tier 仕様、および UC 間 API 依存マップへ
payload schema title をアンカーする方針を採った（disposition: applied）。

対象は非同期イベントを持つ 5 UC・6 event に限定し、他 UC は再生成していない。

## CR-d0f57ea2-006#1 の分析

design 側の今回変更（`components.ui[]` への `path` / `exports` / `usage` 付与、
`LoadingState` の import 規約明記、Story docs への import 解決表追加）は
デザイン資産内で完結する。spec 側は前イベントで
「loading 表現は `LoadingState` に一本化し、画面が `Skeleton` / `Spinner` を直接 import しない」を
presentation tier 仕様 49 ファイルへ反映済みであり、今回の design 変更と矛盾しない。
追加変更不要（status: already_current）。

## RDRA 整合性

RDRA に存在しない要素の追加は行っていない。UC 数 41 / 業務 7 / BUC 13 は変更なし。

## 残課題（確認推奨項目）

1. tier-worker 仕様の DLQ チャネル名（`notification.dun.requested.dlq` /
   `notification.remind.requested.dlq`）が asyncapi.yaml の
   `notification.dun.dlq` / `notification.remind.dlq` と不一致。
   本 work unit（asyncapi-payload-title）の範囲外のため本イベントでは修正していない。
2. 「期限超過の貸出を延滞にする」「返却期限接近の貸出を判定する」の 2 UC は
   tier-worker で publish しているが `_api-summary.yaml` の `async_events` が空。
   同じく本 work unit の範囲外。
