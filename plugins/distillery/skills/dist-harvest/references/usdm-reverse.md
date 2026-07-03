# analysis → USDM 逆生成タスク

Phase1〜5 の analysis ドキュメントを入力として、現行システムが実現している価値を **as-is 要求** として
USDM（要求・理由・仕様）に構造化し、`requirements.yaml` を逆生成する。

> 通常の USDM 分解（`dist-requirements/references/usdm/usdm-decompose.md`）が「変更要望テキスト」から
> 要求を導くのに対し、本タスクは「解析済みの analysis ドキュメント」から現行の要求を復元する点が異なる。
> スキーマ本体は `dist-requirements/references/usdm-schema.md` に完全準拠し、
> `confidence` / `evidence` の拡張フィールドを加える（`evidence-rules.md`）。

## 入力

- `docs/harvest/events/{event_id}/analysis/01-overview.md`〜`05-internal.md`
- `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/usdm-schema.md` — USDM スキーマ
- `${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/references/event-sourcing-rules.md` — イベントソーシング
- `evidence-rules.md`（本スキル）— confidence / evidence 規則

## 出力

- `docs/usdm/events/{event_id}/requirements.yaml`
- `docs/usdm/events/{event_id}/source.txt` — 解析対象の要約（対象リポジトリのパス・コミット・
  逆生成である旨を記載。`docs/harvest/events/{event_id}/sources.md` の内容を要約して転記する）

`{event_id}` は USDM 側の event_id（`{YYYYMMDD_HHMMSS}_harvest_initial`）。日時は
`date '+%Y%m%d_%H%M%S'` / `date '+%Y-%m-%dT%H:%M:%S'` コマンドで取得する。LLM が日時を推測してはならない。
harvest / usdm / rdra で event_id は揃えてよい（同一逆生成イベントのため）。

## 手順

### 1. 要求の抽出（as-is）

- Phase2 の要求・機能要求と、Phase3 の業務/BUC を突き合わせ、現行システムが実現している価値を
  独立した要求（Requirement）として抽出する。
- 「これから作りたい」ではなく「すでに実現されている」観点で記述する。
- 粒度の目安: 1 BUC ≒ 1〜数要求。UC の集合が 1 つの価値を成すならまとめる。
- ID は `REQ-001` から連番（初期構築のため既存 ID との重複考慮は不要）。

### 2. 理由（reason）の記述

- 各要求の「なぜ」を Phase1〜3（README・ドキュメント・ビジネスドメイン）から探す。
- ドキュメント/コミット履歴から読めた場合は `confidence: high|medium`。
- 読めない場合は業務ドメイン一般論から推測し、`confidence: low` を付ける。
  reason を空にしてはならない（スキーマで必須）。推測でも必ず 1 文書く。

### 3. 仕様（specification）への分解

- 各要求を、実装から読み取れた具体的な仕様に分解する（Phase4 の UC・Phase5 の情報/状態/条件が源）。
- `acceptance_criteria` はテストコード（Phase4/5 で参照したテスト）から吸い上げられる場合は反映する。
  Given/When/Then 形式を推奨。読めない場合は仕様記述から導ける検証可能な基準を最低 1 件書く（必須）。
- ID は `SPEC-{要求連番3桁}-{仕様連番2桁}`。

### 4. 影響モデル（affected_models）

- 各仕様が対応する RDRA 要素を列挙する。type は
  `actor | information | state | buc | condition | variation | external_system | business_policy`。
- **初期構築のため action は全て `add`**。target は analysis で確定した要素名を使う。

### 5. 拡張フィールド（confidence / evidence）

各 requirement / specification に付与する（`evidence-rules.md` 準拠）:

- `confidence`: `high | medium | low`
- `evidence`: 配列。各要素は `path`（必須）と `note`（任意）。analysis ドキュメントで記録した
  根拠（`事実: path:line`）をここに転記する。推測項目は `path: "推測"` とし `note` に手がかりを書く。

### 6. システム名

- Phase1 で決定したシステム名を `system_name` に設定する。

### 7. 優先度

- as-is 要求の優先度は、システムの中核機能を `must`、補助機能を `should`、周辺機能を `could` と判定する。
  判断材料が薄い場合は `should` を既定とし confidence に反映する。

## 出力例（抜粋）

```yaml
version: "1.0"
event_id: "20260703_120000_harvest_initial"
created_at: "2026-07-03T12:00:00"
source: "逆生成: ./system-sekkei (commit a1b2c3d) を dist-harvest で解析"
system_name: "図書館システム"

requirements:
  - id: "REQ-001"
    requirement: "会員が蔵書を借りられる貸出業務を提供する"
    reason: "図書館の中核サービスであり、来館者への蔵書提供が主目的（README の目的記述より）"
    priority: "must"
    confidence: "high"
    evidence:
      - path: "backend/models/loan.rb:1"
        note: "貸出情報エンティティ"
      - path: "docs/README.md:10"
        note: "貸出返却業務の効率化が目的と記載"
    specifications:
      - id: "SPEC-001-01"
        specification: "会員種別ごとの貸出上限冊数まで蔵書を貸し出せる"
        confidence: "medium"
        evidence:
          - path: "spec/features/loan_spec.rb:20"
            note: "大人会員は10冊まで、のテストケース"
        acceptance_criteria:
          - "Given 大人会員が9冊借りている When 1冊貸出 Then 貸出が成功する"
          - "Given 大人会員が10冊借りている When 1冊貸出 Then 上限超過で拒否される"
        affected_models:
          - type: "information"
            action: "add"
            target: "貸出情報"
          - type: "variation"
            action: "add"
            target: "会員種別"
          - type: "condition"
            action: "add"
            target: "貸出制限"
```

## バリデーション

出力後、必ずバリデータを実行する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/validateRequirements.js docs/usdm/events/{event_id}/requirements.yaml
```

- 終了コード 0（PASS）: 次へ進む
- 終了コード 1（FAIL）: エラーを確認し requirements.yaml を修正して再実行する。主な修正対象:
  - 必須フィールド（`version`, `event_id`, `created_at`, `source`, `system_name`）
  - ID 形式（`REQ-001`, `SPEC-001-01`）、`priority` の値、`affected_models` の必須3項目
  - `reason` / `acceptance_criteria` が空でないこと
  - `confidence`/`evidence` は拡張フィールドであり検証対象外だが、YAML 構造として正しくネストすること

## スナップショット + Markdown 生成

バリデーション PASS 後、`event-sourcing-rules.md` に従い `docs/usdm/latest/requirements.yaml` を作成
（初期構築なので events の内容をそのままコピー）し、Markdown を生成する:

```bash
node ${CLAUDE_PLUGIN_ROOT}/skills/dist-requirements/scripts/generateRequirementsMd.js docs/usdm/latest/requirements.yaml
```

→ `docs/usdm/latest/requirements.md` が生成される（決定論的スクリプト）。
