# USDM スキーマ定義

USDM（Universal Specification Describing Manner）は要求を「要求・理由・仕様」の3階層で構造化する手法。
本パイプラインでは YAML 形式で管理する。

## requirements.yaml フォーマット

```yaml
version: "1.0"
event_id: "{timestamp}_{変更名}"
created_at: "YYYY-MM-DDTHH:MM:SS"
source: "変更要望テキストのファイルパスまたは説明"
system_name: "対象システムの名称"

requirements:
  - id: "REQ-001"
    requirement: "要求の記述（何を実現したいか）"
    reason: "この要求が必要な理由（なぜ必要か）"
    priority: "must | should | could"
    specifications:
      - id: "SPEC-001-01"
        specification: "仕様の記述（どのように実現するか）"
        acceptance_criteria:
          - "受け入れ基準1"
          - "受け入れ基準2"
        affected_models:
          - type: "actor | information | state | buc | condition | variation | external_system | business_policy"
            action: "add | modify | delete"
            target: "影響を受けるモデル要素名"
      - id: "SPEC-001-02"
        specification: "..."
  - id: "REQ-002"
    requirement: "..."
    reason: "..."
    priority: "..."
    specifications:
      - id: "SPEC-002-01"
        specification: "..."
```

## フィールド説明

### system_name（システム名）

- 対象システムの名称を記述する
- 変更要望テキストの内容から自然な日本語のシステム名を1つ抽出・決定する
- 既存の `docs/usdm/latest/requirements.yaml` に `system_name` が存在する場合は、それを引き継ぐ（変更要望でシステム名の変更が明示されない限り）
- RDRA モデルの `システム概要.json` の `system_name` と一致させる

### requirement（要求）

- ビジネス観点での「何を」実現したいかを記述する
- 1つの変更要望から複数の要求が抽出されうる
- ID は `REQ-{連番3桁}` 形式

### reason（理由）

- その要求がなぜ必要かを記述する
- ビジネス価値、ユーザー課題、法規制対応などの背景を含む

### specification（仕様）

- 要求を満たすための具体的な仕様を記述する
- 1つの要求に対して複数の仕様が定義されうる
- ID は `SPEC-{要求連番3桁}-{仕様連番2桁}` 形式

### affected_models（影響モデル）

- この仕様が RDRA モデルのどの要素に影響するかを記述する
- `action` は追加（add）/ 変更（modify）/ 削除（delete）
- `type` は RDRA のモデル種別（アクター、情報、状態、BUC、条件、バリエーション、外部システム、ビジネスポリシー）
- `target` は影響を受ける具体的な要素名（既存要素の場合は latest/ の TSV に存在する名称）

### acceptance_criteria（受け入れ基準）

- 仕様が正しく実現されたかを判定するための基準
- BDD の Given/When/Then 形式を推奨するが、自然言語でも可

## ディレクトリ配置

```
docs/usdm/
  events/
    {timestamp}_{変更名}/
      requirements.yaml      # USDM 分解結果
      source.txt              # 元の変更要望テキスト（コピー）
  latest/
    requirements.yaml         # 全要求の最新スナップショット（累積）
```

## イベント ID 規則

- `{YYYYMMDD_HHMMSS}_{変更名の snake_case}`
- 例: `20260326_143000_add_reservation_feature`
