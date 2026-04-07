# Step3: Infra フィードバック → Arch 更新タスク

MCL product-design の出力を分析し、ベンダーニュートラルな知見を抽出してアーキテクチャ設計にフィードバックする。

## 入力ファイル

1. `specs/product/output/product-workload-model.yaml` — ワークロードモデル
2. `specs/product/output/product-mapping-{vendor}.yaml` — 各クラウドのサービスマッピング
3. `specs/product/output/product-impl-{vendor}.yaml` — 各クラウドの実装仕様
4. `specs/product/output/product-observability.yaml` — オブザーバビリティ仕様
5. `specs/product/output/product-cost-hints.yaml` — コスト最適化ヒント
6. `docs/arch/latest/arch-design.yaml` — 現在のアーキテクチャ設計

## フィードバック抽出手順

`references/arch-feedback-rules.md` のルールに従い、以下の順でフィードバック項目を抽出する。

### MCL 出力→フィードバック項目マッピングテーブル

以下のテーブルに従い、MCL 出力ファイルからフィードバック項目を抽出する。

| MCL 出力ファイル | 参照セクション | 抽出項目 | arch-design.yaml ターゲット |
|---|---|---|---|
| `product-impl-*.yaml` | `components[].configuration` | DB 接続プール上限、MQ タイムアウト、FaaS 時間制限等のベンダー共通技術制約 | `technology_context.constraints[]` |
| `product-observability.yaml` | `sli_slo[]` | SLI/SLO 定義があれば CTP として追加 | `system_architecture.cross_tier_policies[]` |
| `product-observability.yaml` | `alerting.rules[]` | アラートしきい値の統一方針 | `system_architecture.cross_tier_rules[]`（検討） |
| `product-cost-hints.yaml` | `cost_monitoring` | 予算管理方針 | `system_architecture.cross_tier_policies[]` |
| `product-cost-hints.yaml` | `spot_eligible[]` | スポット/プリエンプティブル適性 | `system_architecture.tiers[].policies[]` |
| `product-cost-hints.yaml` | `data_transfer[]` | CDN キャッシュ率目標等 | `system_architecture.tiers[].policies[]` |
| `product-mapping-*.yaml` | `mappings[].fidelity` | fidelity=partial/gap/workaround の制約 | `system_architecture.cross_tier_rules[]` |
| `product-mapping-*.yaml` | `mappings[].fidelity` | fidelity=exact の storage 適合確認 | `data_architecture.storage_mapping[].confidence` 昇格 |

### 1. 技術制約の抽出

**product-impl-{vendor}.yaml** を全クラウド分読み取り、ベンダー共通の制約を抽出する:

- DB 接続プール上限
- MQ メッセージサイズ上限
- FaaS 実行時間上限
- Object Storage オブジェクトサイズ上限
- API Gateway リクエストサイズ上限

**ベンダーニュートラル化**: ベンダー固有のサービス名（RDS, Cloud SQL 等）はベンダーニュートラルな表現（RDB, MQ, FaaS 等）に変換する。

複数クラウドに共通する制約のみをフィードバック対象とする。1 クラウドのみの場合はそのクラウドの制約をそのまま使用するが、ベンダーニュートラルに表現する。

#### 複数クラウド時の制約集約ルール

| 対象クラウド数 | 制約の扱い |
|---|---|
| 1 クラウドのみ | そのクラウドの制約をそのままベンダーニュートラル化して追加 |
| 2 クラウド以上 | 全対象クラウドに共通する制約のみ追加。値が異なる場合は最も厳しい値を採用（例: DB 接続プール上限が AWS=200, Azure=300 → 200 を採用） |
| 値の乖離が大きい場合 | ユーザーに確認（例: AWS=200, GCP=500 → 「200 と 500 で大きな差があります。どちらに合わせますか？」） |

### 2. オブザーバビリティ方針の抽出

**product-observability.yaml** を読み取り、arch レベルの方針を抽出する:

- SLI/SLO 定義がある場合 → クロスティアポリシー「SLI/SLO ベースのオブザーバビリティ方針」を追加
- アラート定義がある場合 → クロスティアルール「アラートしきい値の統一」を検討
- ダッシュボード定義がある場合 → 特にフィードバック不要（インフラレベルの詳細）

### 3. サービスマッピング fidelity の分析

**product-mapping-{vendor}.yaml** を読み取り、fidelity gap を分析する:

- `fidelity: "partial"` — 部分適合。制約事項をクロスティアルールとして追加検討
- `fidelity: "gap"` — 適合不可。代替手段をクロスティアルールとして追加検討
- `fidelity: "workaround"` — 回避策。追加の考慮事項をクロスティアルールとして追加検討
- `fidelity: "exact"` — 完全適合。storage_mapping の confidence 昇格候補

### 4. コスト最適化方針の抽出

**product-cost-hints.yaml** を読み取り、arch レベルの方針を抽出する:

- スポット/プリエンプティブル適性がある場合 → ティア固有ポリシーとして追加
- CDN キャッシュ推奨がある場合 → ティア固有ポリシーとして追加
- オートスケーリング推奨がある場合 → ティア固有ポリシーとして追加

### 5. 横断的関心事のチェック

MCL impl spec と observability spec を分析し、横断的関心事（cross-cutting concerns）が arch の cross_tier_policies/rules で全ティアカバーされているかを確認する。特定ティアのルールに閉じているが本来全ティアに適用すべき設計方針を検出する。

**チェック対象の横断的関心事**:

| 関心事 | MCL での検出箇所 | arch での期待 |
|--------|----------------|-------------|
| 冪等性 | impl の冪等キー設計、DLQ 設定、ON CONFLICT | cross_tier_policies に全ティア共通の冪等性方針があるか。特定ティアの SR にのみ閉じていないか |
| トレーサビリティ | observability の trace propagation、correlation ID | cross_tier_policies の構造化ログ方針に trace_id の生成元・伝播方式が明記されているか |
| エラーハンドリング | impl のサーキットブレーカー、リトライ設計 | cross_tier_rules にエラーハンドリング方針があるか。外部連携ティアだけでなく全ティアに適用されているか |
| 認証/認可の一貫性 | impl の認証フロー | cross_tier_policies の認証/認可方式と impl の実装が整合しているか |

**チェック手順**:
1. MCL impl から冪等性・トレーサビリティ・エラーハンドリングの設計パターンを抽出する
2. arch の cross_tier_policies/rules に対応する方針が存在するか確認する
3. 存在しない場合、または特定ティアの SR にのみ閉じている場合、cross_tier_policies/rules への昇格をフィードバック項目として追加する
4. 既存の方針がある場合でも、MCL の設計で判明した詳細（各層での具体的な対処方法等）で補強すべきかを検討する

### 6. ストレージマッピング confidence の昇格

**product-mapping-{vendor}.yaml** の fidelity = "exact" と `docs/arch/latest/arch-design.yaml` の `data_architecture.storage_mapping` を照合する:

- storage_type が MCL で exact fidelity 確認済み → confidence 昇格
- `references/arch-feedback-rules.md` の昇格ルールに従う

## ユーザー確認

抽出したフィードバック項目をユーザーに提示し、確認する。

### 提示フォーマット

```markdown
## インフラ設計からのアーキテクチャフィードバック

MCL product-design の結果を分析し、以下のフィードバック項目を抽出しました。

### 技術制約の追加（technology_context.constraints）

| # | 制約 | 根拠 |
|---|------|------|
| 1 | {制約内容} | {MCL 出力ファイル名} |

### クロスティアポリシーの追加（cross_tier_policies）

| # | ID | 名前 | 説明 | 根拠 |
|---|-----|------|------|------|
| 1 | CTP-{NNN} | {名前} | {説明} | {MCL 出力} |

### ストレージマッピング confidence の昇格

| # | エンティティ | 変更前 | 変更後 | 根拠 |
|---|------------|--------|--------|------|
| 1 | E-{NNN} | medium | high | {MCL mapping fidelity} |

---

上記のフィードバックを arch-design.yaml に反映してよいですか？
1. 全て反映する
2. 一部を選択して反映する（番号を指定）
3. フィードバックを見送る
```

## arch-design.yaml の更新

ユーザー確認後、以下の手順で更新する:

### 1. 現在の arch-design.yaml の読み込み

`docs/arch/latest/arch-design.yaml` を読み込む。

### 2. フィードバックの反映

確認済みの項目を arch-design.yaml に反映する:

- **technology_context.constraints**: 配列の末尾に追加
- **cross_tier_policies / cross_tier_rules**: 配列の末尾に追加（ID は最大値 +1 で採番）
- **tiers[].policies**: 該当ティアの policies 配列の末尾に追加
- **storage_mapping[].confidence**: 値を更新

### 3. confidence: "user" の保護確認

反映前に、変更対象の項目が confidence: "user" でないことを確認する。

### 4. event_id と metadata の更新

- `event_id`: `{YYYYMMDD_HHMMSS}_arch_infra_feedback_{infra_event_id}`（日時は `date '+%Y%m%d_%H%M%S'` コマンドで取得）
- `created_at`: `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得した現在日時
- `source`: `"インフラ設計 {infra_event_id} に基づくアーキテクチャフィードバック"`

## arch フィードバックイベントの記録

既存の arch 出力手順（architecture スキルの Step3）に完全準拠する:

1. `docs/arch/events/{feedback_event_id}/arch-design.yaml` — 全量（フィードバック反映済み）
2. `docs/arch/events/{feedback_event_id}/_inference.md` — フィードバック根拠
3. `docs/arch/events/{feedback_event_id}/source.txt`
4. バリデーション: `validateArchDesign.js`
5. Markdown 生成: `generateArchDesignMd.js`
6. カバレッジレポート生成: `generateCoverageReport.js`
7. スナップショット更新: `docs/arch/latest/` を全量上書き
8. latest の Markdown + カバレッジレポート再生成

## infra-event.yaml の更新

フィードバック完了後、`docs/infra/events/{infra_event_id}/infra-event.yaml` の `arch_feedback` セクションを更新する:

```yaml
arch_feedback:
  arch_feedback_event_id: "{feedback_event_id}"
  feedback_items:
    - target: "{ターゲットパス}"
      action: "{add|upgrade}"
      id: "{ID}"  # policy/rule の場合
      description: "{フィードバック内容}"
      source: "{MCL 出力ファイル名}"
```

infra スナップショットも更新する。
