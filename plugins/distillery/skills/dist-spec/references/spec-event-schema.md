# spec-event.yaml スキーマ定義

Spec 生成イベントのメタデータを構造化する YAML フォーマット。

## フォーマット

```yaml
version: "1.0"
event_id: "{YYYYMMDD_HHMMSS}_spec_generation"
created_at: "YYYY-MM-DDTHH:MM:SS"
source: "Spec 生成: {トリガー説明}"

# UC 一覧（業務/BUC/UC の階層構造）
use_cases:
  - business: "{業務名}"
    buc: "{BUC名}"
    uc: "{UC名}"
    files:
      - spec.md
      - tier-{tier_id}.md   # arch-design.yaml の tiers から動的に決定
    api_count: {APIエンドポイント数}
    async_event_count: {非同期イベント数}

# 全体横断仕様
cross_cutting:
  ux_design:
    user_flows: {フロー数}
    ia_pages: {IA ページ数}
    psychology_principles: {適用した心理学原則数}
  ui_design:
    layout_patterns: {レイアウトパターン数}
    responsive_breakpoints: {ブレイクポイント数}
    component_guidelines: {ガイドライン数}
  data_visualization:
    target_screens: {対象画面数}
    chart_types: {チャート種別数}
  openapi:
    api_count: {統合 OpenAPI のエンドポイント数}
  asyncapi:
    async_event_count: {統合 AsyncAPI のイベント数（0の場合 asyncapi.yaml は未生成）}

# 生成統計
stats:
  total_ucs: {UC 総数}
  total_apis: {API エンドポイント総数}
  total_async_events: {非同期イベント総数}
  businesses: {業務数}
  bucs: {BUC 数}
```

## フィールド説明

### 必須フィールド

| フィールド | 型 | 説明 |
|-----------|---|------|
| version | string | スキーマバージョン。固定値 `"1.0"` |
| event_id | string | イベント ID。`{YYYYMMDD_HHMMSS}_spec_generation` 形式 |
| created_at | string | 作成日時。ISO 8601 形式 |
| source | string | トリガー説明 |
| use_cases | array | UC 一覧 |
| cross_cutting | object | 全体横断仕様のサマリー |
| stats | object | 生成統計 |

### use_cases[].files

UC ディレクトリに存在するファイルの一覧。以下のファイルが候補:

- `spec.md` — 必須
- `tier-{tier_id}.md` — arch-design.yaml の tiers から動的に決定（例: tier-frontend.md, tier-api.md, tier-worker.md）

### confidence 値

各要素に確信度を付ける場合:
- `high` — RDRA モデルから直接導出
- `medium` — 推論で補完
- `low` — 仮定に基づく
