# アーキテクチャ設計 イベントソーシングルール

## Feedback request lineage

`feedback_packet` 指定時も既存のトリガー説明を`source.txt`の先頭に保ち、その後へfeedback identityと
packet pathを追記する。参照されるevent YAMLには次のcanonical envelopeをexactに記録する。

```yaml
feedback_request:
  feedback_request_id: "{feedback_id}"
  input_sha256: "{run/input.md sha256}"
  request_ids: ["CR-..."]
  work_unit_ids: ["CR-...#1"]
```

4キーだけをこの順序・2-space indentで置き、値は`JSON.stringify`互換のquoted scalar / inline arrayにする。
`request_ids`はcausal work unitから導いた一意な要求ID、`work_unit_ids`は`causal_work_unit_ids`そのものを
plan順で記録する。direct集合・packet pathはenvelopeへ追加せず、必要なら別top-level field、`source.txt`、
controller stage eventへ記録する。`_changes.md`にも同じlineageを人が読める形で残す。
CR本文は`run/input.md`の対象byte sliceが正本であり、event側へ複製しない。

## Feedback controller checkpoint

stage skillはdomain eventとlatest更新を行い、controllerがstage ledgerとexecution basisを確定する。

成功時の`work_unit_results`はdirect集合、`reconciliation_results`はcausal集合をplan順でexactly once覆う。

直接ownerの対応は`applied→changed`、`merged→already_current`、`deferred|rejected→blocked_by_owner`である。

`work_unit_evidence_refs`は`changed | already_current`の全work-unit/artifact pairをpathとactual SHA-256でexactに覆う。

changedが0件なら、当該stageの各catalog domain rootへ`feedback-disposition.json`だけを持つeventを1件追記し、`latest/`を変更しない。

changedが1件以上なら全domain rootをnormal eventまたはno-change manifestで覆い、少なくとも1rootの`latest/`を更新する。

failed時は`work_unit_results / reconciliation_results / work_unit_evidence_refs / domain_event_refs`を空配列にする。

controllerはeventの`created_at / run_id / attempt / post_execution_basis`をartifact rootから確定し、stage返却値をそのまま信頼しない。

root snapshotは全event ID集合、head event tree、latest treeをhashする。

過去のnon-head event tree全体は再hashしないため、参照した過去artifactはevidence refの個別SHA-256でbindする。


アーキテクチャ設計の変更をイベントとして記録し、スナップショットを逐次更新する方式。
差分イベント + latest マージ方式を採用する。

## 基本概念

```
events/        — 差分イベント履歴（変更セクションのみ。追記のみ、不変）
latest/        — 最新スナップショット（実ディレクトリ。差分をマージした結果）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
- `latest/` は実ディレクトリであり、差分イベントをマージした結果を保持する
- 新しい変更は `events/` に差分イベントとして記録してから `latest/` にマージする

## ディレクトリ構成

```
docs/arch/
  events/{event_id}/
    arch-design-diff.yaml   # 変更セクションのみ（差分）
    _changes.md             # 変更サマリ（何を追加/変更/削除したか）
    _inference.md           # 推論根拠サマリ
    source.txt              # トリガー説明
    decisions/              # 決定記録（arch-decision-001.yaml, ...）
  latest/
    arch-design.yaml        # 全セクションの完全版（マージ結果）
    arch-design.md          # Markdown 表現（Mermaid 図含む）
    decisions/              # 決定記録（events からコピー）
```

## イベント ID

- 形式: `{YYYYMMDD_HHMMSS}_{変更名}`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- `created_at` 等のタイムスタンプも `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する
- 変更名は変更内容を表す短い snake_case の名前
- 例:
  - 初期構築: `20260328_100000_initial_arch`
  - RDRA 差分起因: `20260328_150000_arch_update_for_reservation`
  - NFR 変更起因: `20260328_160000_arch_update_for_nfr_perf`
  - Infra フィードバック: `20260328_170000_arch_infra_feedback`
  - 手動更新: `20260328_180000_arch_manual_update`

## トリガーイベント

各イベントには前段スキルのイベントIDを記録する:

- `trigger_event`: 前段イベントID（例: `rdra:20260328_143000_add_reservation`, `nfr:20260328_150000_nfr_update`）
- `_changes.md` および `arch-design-diff.yaml` のメタデータに記録する

## イベントの構成

各イベントディレクトリには、**変更があったセクションのみ**を含める（差分イベント）。

### arch-design-diff.yaml

変更セクションのみを含む。各要素はそれぞれのマージキーで照合する。

```yaml
meta:
  event_id: "{event_id}"
  trigger_event: "rdra:{rdra_event_id}"
  created_at: "2026-03-28T15:00:00"
system_architecture:
  tiers:                          # 追加/変更されたティアのみ
    - id: "api-tier"
      name: "API ティア"
      pattern: "FaaS"
      rationale: "予約APIの追加に伴いティアを新設"
app_architecture:
  tier_layers:                    # 変更されたレイヤーのみ
    - tier_id: "api-tier"
      layers:
        - name: "handler"
          responsibility: "リクエスト受付"
data_architecture:
  entities:                       # 追加/変更されたエンティティのみ
    - name: "Reservation"
      type: "event-sourced"
      tier_id: "api-tier"
  policies:                       # 追加/変更されたポリシーのみ
    - name: "reservation-retention"
      type: "retention"
      rule: "5年保持"
```

### _changes.md

```markdown
# 変更サマリ

- event_id: {event_id}
- trigger_event: rdra:{rdra_event_id}

## 追加
- system_architecture/tiers: api-tier（予約API用ティア）
- data_architecture/entities: Reservation（予約エンティティ）

## 変更
- app_architecture/tier_layers/api-tier: handler レイヤーの責務を更新

## 削除
- なし
```

### source.txt

トリガー説明テキスト。

## スナップショット更新ルール

### latest へのマージ

イベント確定後、`latest/arch-design.yaml` に差分をマージする:

- **マージキー**:
  - `domain_architecture.subdomains`: `id` で照合
  - `domain_architecture.bounded_contexts`: `id` で照合
  - `domain_architecture.context_map`: `id` で照合
  - `domain_architecture.aggregate_hypotheses`: `id` で照合
  - `system_architecture.tiers`: `id` で照合
  - `app_architecture.tier_layers`: `tier_id` で照合
  - `data_architecture.entities`: `name` で照合
  - `data_architecture.policies`: `name` で照合
- **追加**: latest に存在しない要素を配列に追加
- **変更**: 同一キーの要素を上書き
- **削除**: `_changes.md` に削除と記載された要素を latest から除去
- **ユーザー確定値の保護**: `confidence: "user"` の項目は差分更新で上書きしない

#### domain_architecture セクション固有のマージルール

- **dist-infrastructure からのフィードバック対象外**: dist-infrastructure が arch-design-diff.yaml を書き戻す際、`domain_architecture` セクションは **触らない**（infra フィードバックは system_architecture / data_architecture のみが対象）。これは domain_architecture が **問題空間の設計** であり、インフラ視点での書き換えを許容しないため
- **新規構築時の最小構成**: 既存スナップショットに `domain_architecture` が無く差分更新時に新規追加する場合、validator は WARN（exit 0）扱い。自動で最小構成を埋めず、ユーザーの明示的なドメイン設計対話を待つ
- **BC.owned_entity_ids[] の整合性**: data_architecture.entities[] とのクロスリファレンスは validator が ERROR レベルでチェックする
- **confidence 上限ルール**: Core SD = medium / BC = medium / Aggregate = low の上限を超えた場合 validator が WARN（exit 0）

マージ後、`arch-design.md` を再生成する。

### decisions/ のスナップショット更新

`latest/decisions/` は **`artifact_id` 単位の upsert**（マージ）で更新する。全置換はしない（過去イベントで確定した有効な判断を破壊しないため）:

1. `latest/decisions/` が存在しなければ作成する
2. `events/{event_id}/decisions/` の各ファイル（`arch-decision-{NNN}.yaml`）を読み込む
3. `latest/decisions/` に同名ファイルがあれば**上書き**、無ければ**追加**（artifact_id で upsert）
4. 廃止された判断は `status: "deprecated"` に変更したファイルを events に記録し、その差分が latest に反映される（ファイル削除はしない）

これにより、latest の決定記録は **全イベントを通じての累積** となり、初期構築から差分更新までの判断履歴がトレース可能となる。

#### 初期構築モード時の動作

初期構築モードでは `events/{event_id}/decisions/` が全決定を含むため、`latest/decisions/` が空の状態への upsert = 全件追加と等価になる（特別扱い不要）。

#### artifact_id の衝突回避

差分更新時に新規追加する決定記録の `artifact_id` は、**`latest/decisions/` の最大連番の次** を採用する。例: latest に `arch-decision-001` 〜 `arch-decision-007` があれば、新規は `arch-decision-008` から。これにより上書きと追加が混在しても ID 衝突しない。

### マージ手順

```bash
# 1. latest/arch-design.yaml を読み込み
# 2. events/{event_id}/arch-design-diff.yaml の各セクションを照合
# 3. confidence: "user" でない項目のみ追加/上書き
# 4. _changes.md の削除セクションに記載された要素を除去
# 5. latest/arch-design.yaml を書き出し
# 6. latest/arch-design.md を再生成（Mermaid 図含む）
```

## 初期構築時の扱い

`docs/arch/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. RDRA モデル + NFR グレードから全セクションを推論する
2. 全量を `arch-design.yaml`（差分ファイル名ではなく完全版）として `events/{event_id}/` に記録する
3. 決定記録を `events/{event_id}/decisions/` に記録する
4. 同じ内容を `latest/arch-design.yaml` にコピーする
5. `events/{event_id}/decisions/` を `latest/decisions/` にコピーする
6. 初期構築イベントの `_changes.md` には全要素を「追加」として記載する
5. 以後の更新は差分イベント方式で動作する

## 差分更新モードの動作

既存のアーキテクチャ設計がある状態で RDRA/NFR が更新された場合:

1. 前段イベントの `_changes.md` を読み取る
   - RDRA: `docs/rdra/events/{rdra_event_id}/_changes.md`
   - NFR: `docs/nfr/events/{nfr_event_id}/_changes.md`
2. 変更された RDRA/NFR 要素に関連するアーキテクチャ項目のみを再推論する
3. 再推論結果を `arch-design-diff.yaml` として新イベントに記録する
4. `latest/arch-design.yaml` に差分をマージする
5. `confidence: "user"` の項目はスキップする（ユーザー確定値を保護）

## 注意事項

- アーキテクチャ設計は RDRA + NFR + ユーザー対話の結果であるため、入力が更新されても自動更新しない
- RDRA/NFR 更新後にアーキテクチャの再評価が必要かはユーザーが判断する
- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
