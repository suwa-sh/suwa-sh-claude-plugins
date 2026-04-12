# インフラ設計 イベントソーシングルール

インフラ設計の変更をイベントとして記録し、スナップショットを逐次更新する方式。
差分イベント + latest マージのハイブリッド方式を採用する。
infra-event.yaml は差分マージ、MCL 出力ファイル群は全量上書きで更新する。

## 基本概念

```
events/        — 差分イベント履歴（追記のみ、不変）
latest/        — 最新スナップショット（実ディレクトリ。差分マージ + MCL 出力上書きの結果）
```

- `events/` 配下のファイルは一度書き込んだら変更・削除しない（イミュータブル）
  - **例外**: infra-event.yaml の `arch_feedback` セクションは Step3 完了時に追記する
- `latest/` は実ディレクトリであり、差分イベントのマージ結果を保持する
- 新しい変更は `events/` に差分イベントとして記録してから `latest/` にマージする

## ディレクトリ構成

```
docs/infra/
  events/{event_id}/
    infra-event-diff.yaml   # 変更フィールドのみ（差分）
    mcl-output/             # MCL 実行結果（全量。差分化不可能）
    product-input.yaml      # 生成した MCL 入力
    _changes.md             # 変更サマリ（何が変わったか）
    _inference.md           # 変換推論根拠
    source.txt              # トリガー説明
  latest/
    infra-event.yaml        # 全フィールドの完全版（マージ結果）
    infra-event.md          # Markdown 表現
    mcl-output/             # MCL 実行結果の最新版（上書き）
    product-input.yaml      # 最新の MCL 入力
```

### arch フィードバックイベント

arch へのフィードバックは **arch の差分イベント方式**に準拠する。
infra 設計結果からベンダーニュートラルな知見を抽出し、arch の差分イベントとして作成する。

```
docs/arch/
  events/{feedback_event_id}/
    arch-design-diff.yaml   # フィードバックによる変更セクションのみ（差分）
    _changes.md             # 変更サマリ
    _inference.md           # フィードバック推論根拠
    source.txt              # トリガー説明
  latest/
    arch-design.yaml        # 差分マージ後の完全版
    arch-design.md          # Markdown 表現
```

## イベント ID

### infra イベント ID

- 形式: `{YYYYMMDD_HHMMSS}_infra_product_design`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する。LLM が日時を推測してはならない**
- `created_at` 等のタイムスタンプも `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する
- 例: `20260328_140000_infra_product_design`

### arch フィードバックイベント ID

- 形式: `{YYYYMMDD_HHMMSS}_arch_infra_feedback`
- **日時部分は `date '+%Y%m%d_%H%M%S'` コマンドで取得する**
- 例: `20260328_143000_arch_infra_feedback`

## イベント ID のユニーク性

- タイムスタンプ形式 `{YYYYMMDD_HHMMSS}` は秒単位のため、1 秒以内の連続実行で重複する可能性がある
- 重複を検出した場合、サフィックス `_2`, `_3` を付与する
- 既存イベントディレクトリとの重複チェックは Step1 のイベントディレクトリ作成時に実施する

## トリガーイベント

各イベントには前段スキルのイベントIDを記録する:

- `trigger_event`: 前段イベントID（例: `arch:20260328_100000_initial_arch`, `nfr:20260328_090000_initial_nfr`）
- `infra-event-diff.yaml` のメタデータおよび `source.txt` に記録する
- arch フィードバックイベントの `trigger_event` は `infra:{infra_event_id}` とする

## イベントの構成

### infra-event-diff.yaml

変更があったフィールドのみを含む差分ファイル。フィールドは `section` + `field_id` で照合する。

```yaml
meta:
  event_id: "{event_id}"
  trigger_event: "arch:{arch_event_id}, nfr:{nfr_event_id}"
  created_at: "2026-03-28T14:00:00"
changes:
  translation_summary:
    workload_type: "web-api"
    tier_count: 7
  mcl_execution:
    status: "success"
    vendor: "aws"
    outputs:
      - "product-workload-model.yaml"
      - "product-mapping-aws.yaml"
      - "product-impl-aws.yaml"
  arch_feedback:
    status: "applied"
    feedback_event_id: "{feedback_event_id}"
```

### _changes.md

```markdown
# 変更サマリ

- event_id: {event_id}
- trigger_event: arch:{arch_event_id}, nfr:{nfr_event_id}

## product-input 変更フィールド
- workload_type: "microservice" → "web-api"
- tier_count: 5 → 7

## MCL 出力ファイル
- product-workload-model.yaml（更新）
- product-mapping-aws.yaml（更新）
- product-impl-aws.yaml（更新）

## arch フィードバック
- applied: cross_tier_policies.resilience に EKS ヘルスチェック追加
```

### MCL 出力（mcl-output/）

MCL は差分出力をサポートしないため、`events/{event_id}/mcl-output/` には全量を記録する。
MCL 出力ファイル一覧:
- `product-workload-model.yaml`
- `product-mapping-{vendor}.yaml`
- `product-impl-{vendor}.yaml`
- `product-observability.yaml`
- `product-cost-hints.yaml`

### arch フィードバックイベント

arch の差分イベント方式に準拠する。フィードバックで変更されたセクションのみを `arch-design-diff.yaml` に含める。
マージキーおよびマージルールは arch の event-sourcing-rules.md に従う。

## スナップショット更新ルール

### latest へのマージ（ハイブリッド）

イベント確定後、以下の手順で `latest/` を更新する:

#### 1. infra-event.yaml の差分マージ

`events/{event_id}/infra-event-diff.yaml` の変更フィールドを `latest/infra-event.yaml` にマージする:

- **マージキー**: `section` + `field_id`
- **追加**: latest に存在しないフィールドを追加
- **変更**: 同一キーのフィールドを上書き
- **`arch_feedback` セクション**: 追記（配列に新規フィードバックを追加）

#### 2. MCL 出力の全量上書き

`events/{event_id}/mcl-output/` の全ファイルを `latest/mcl-output/` に上書きする:

```bash
rm -rf docs/infra/latest/mcl-output/
cp -r docs/infra/events/{event_id}/mcl-output/ docs/infra/latest/mcl-output/
```

MCL 出力は差分化できないため、毎回全量置換する。

#### 3. 付随ファイルの更新

- `latest/product-input.yaml` を `events/{event_id}/product-input.yaml` で上書き
- `latest/infra-event.md` を再生成

### arch スナップショット（フィードバック時の差分マージ）

arch フィードバックは arch の差分イベント方式に従い、`latest/arch-design.yaml` にマージする:

1. `docs/arch/events/{feedback_event_id}/arch-design-diff.yaml` を作成する
2. `docs/arch/latest/arch-design.yaml` に差分をマージする
   - マージキー: arch の event-sourcing-rules.md に従う
   - `confidence: "user"` の項目は上書きしない
3. `docs/arch/latest/arch-design.md` を再生成する

## 初期構築時の扱い

`docs/infra/latest/` が空（または存在しない）場合は初期構築モードとなる:

1. MCL を実行し、全出力を `events/{event_id}/mcl-output/` に記録する
2. `infra-event.yaml`（差分ファイル名ではなく完全版）を `events/{event_id}/` に記録する
3. 全量を `latest/` にコピーする
4. 初期構築イベントの `_changes.md` には全フィールドを「追加」として記載する
5. 以後の更新は差分イベント方式で動作する

## 差分更新モードの動作

既存のインフラ設計がある状態で Arch/NFR が更新された場合:

1. 前段イベントの `_changes.md` を読み取り、product-input への影響を判定する
2. 影響がある場合:
   a. 新しい product-input.yaml を生成する
   b. MCL を再実行する
   c. `infra-event-diff.yaml` に変更フィールドを記録する
   d. `latest/` にハイブリッドマージする（infra-event 差分マージ + MCL 全量上書き）
3. 影響がない場合:
   a. MCL 再実行をスキップする
   b. `_changes.md` に「影響なし、MCL 再実行スキップ」と記録する

## 注意事項

- infra イベントは arch-design.yaml + nfr-grade.yaml の現在の状態を入力とする
- arch フィードバックは infra 設計結果に基づくが、ベンダーニュートラルな知見のみを反映する
- confidence: "user" の項目はフィードバック時にも変更しない（ユーザー確定値を尊重）
- イベントは時系列順に適用すること（event_id のソートで時系列が保証される）
- MCL 出力の差分化は MCL 側の制約により不可能。全量上書きで対応する
- latest/ のファイルを直接手動編集した場合、events/ との整合性が崩れる — その場合は手動編集もイベントとして記録する
