# Step4: Infra 書き戻しチェック

Step3 の Arch フィードバック反映後、その変更が product-input.yaml の入力フィールドに影響を与え、MCL の再実行が必要になるかを判定する。

## 判定フロー

### 1. フィードバック前後の差分を特定する

フィードバック前の Arch: `docs/arch/events/{前回 arch event_id}/arch-design.yaml`
フィードバック後の Arch: `docs/arch/latest/arch-design.yaml`

差分が以下のカテゴリに該当するかをチェックする。

### 2. 影響判定マトリクス

| Arch 変更カテゴリ | 影響する product-input フィールド | 影響度 | 再実行要否の判断基準 |
|---|---|---|---|
| **ティアの追加・削除** | `workload_type` | high | ティア構成が変わると workload_type 推論が変わる可能性。要再実行 |
| **認証/認可方式の変更** (CTP の authentication/authorization 関連) | `data_sensitivity.classification`, `data_sensitivity.compliance` | high | 認証レベルが上がれば classification が変わる。要再実行 |
| **DR 方針の追加・変更** (CTP の業務継続/災害対策関連) | `recovery_target.rpo`, `recovery_target.rto` | medium | RPO/RTO の数値が変わった場合のみ要再実行 |
| **外部連携の追加** (tier-external-* の追加) | `data_sensitivity.compliance`, `consistency_needs` | high | 新たな外部連携（特に決済・規制系）は compliance に影響。要再実行 |
| **technology_context.constraints の追加** | `traffic_pattern.baseline_rps` (間接) | low | 接続プール制限等はインフラ側で既に考慮済み。通常は再実行不要 |
| **storage_mapping の storage_type 変更** (rdb → nosql 等) | `consistency_needs.type` | high | strong/eventual が変わる。要再実行 |
| **storage_mapping の confidence 昇格のみ** | なし | none | product-input に confidence は含まれない。再実行不要 |
| **cross_tier_policies の追加（情報提供系）** | なし | none | SLI/SLO 方針やコスト方針は MCL 出力の反映であり循環しない。再実行不要 |
| **cross_tier_rules の追加** | なし | none | 運用制約は product-input に含まれない。再実行不要 |
| **ティア固有 policies の追加** | なし | none | スポット適性や CDN 方針は MCL 出力の反映。再実行不要 |

### 3. 判定ロジック

```
影響度 high が 1 件以上 → 「要再実行」
影響度 medium のみ    → ユーザーに判断を委ねる（「推奨: 次回反映」or「今すぐ再実行」）
影響度 low/none のみ  → 「再実行不要」
```

### 4. 典型的な「再実行不要」パターン

以下のフィードバックのみで構成される場合は再実行不要:

- MCL 出力のベンダーニュートラル化を Arch に戻しただけ（情報の双方向同期）
- storage_mapping の confidence 昇格のみ
- SLI/SLO やコスト方針を CTP として追加しただけ
- 運用制約（CTR）の追加のみ
- ティア固有のスポット/CDN 方針の追加のみ

これらは MCL 出力を Arch に反映しただけであり、反映結果が product-input に新たな情報を追加しないため循環しない。

### 5. 典型的な「要再実行」パターン

以下のケースは MCL 再実行が必要:

- ユーザーがフィードバック確認時に追加の設計判断を行い、ティア構成を変更した
- フィードバックをきっかけにユーザーが認証方式を見直した
- storage_type の変更を伴う設計見直しが発生した
- 新たな外部システム連携が識別された

## 出力フォーマット

### 再実行不要の場合

```
Step4: Infra 書き戻しチェック → 不要
  - Arch への変更は product-input.yaml の入力フィールドに影響しません
  - {理由の要約}
```

### 再実行が必要な場合

```
Step4: Infra 書き戻しチェック → 要再実行

以下の Arch 変更が product-input.yaml に影響します:

| # | Arch 変更内容 | 影響する product-input フィールド | 影響度 |
|---|-------------|-------------------------------|--------|
| 1 | {変更内容} | {フィールド名} | {high/medium} |

推奨アクション:
1. product-input.yaml を再生成し、Step1 から再実行する
2. 影響が軽微なため今回はスキップし、次回の Infra パイプライン実行時に反映する
```

### 再実行フロー

ユーザーが「1. 再実行」を選択した場合:

1. **新規 event_id を採番する**: `{YYYYMMDD_HHMMSS}_infra_product_design_r{N}`（r2, r3...で再実行回数を示す。日時は `date '+%Y%m%d_%H%M%S'` コマンドで取得）
2. **Step1 に戻り product-input.yaml を再生成する**:
   - フィードバック反映後の `docs/arch/latest/arch-design.yaml` を入力とする
   - 新規 event ディレクトリ `docs/infra/events/{new_event_id}/` に生成
3. **Step2 以降を再実行する**
4. **Step3 のフィードバック確認時に、前回との差分を明示する**:
   - 「前回のフィードバック項目のうち、再実行で変化したもの」を表示
5. **再実行は最大 2 回まで**: 2 回再実行しても書き戻しが必要な場合、アーキテクチャ設計の見直しを提案する
6. **既存イベントの扱い**: 前回の infra event / arch feedback event は削除しない（履歴として保持）。latest のみ新規イベントで上書きする
