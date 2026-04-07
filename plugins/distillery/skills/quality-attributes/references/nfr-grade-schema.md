# NFR グレード YAML スキーマ定義

非機能要求グレードの評価結果を YAML 形式で管理するスキーマ。

## nfr-grade.yaml フォーマット

```yaml
version: "1.0"
event_id: "{YYYYMMDD_HHMMSS}_{変更名}"
created_at: "YYYY-MM-DDTHH:MM:SS"
source: "トリガーの説明（初期構築/RDRA差分更新等）"

model_system:
  type: "model1 | model2 | model3"
  reason: "モデルシステム選定根拠"

categories:
  - id: "A"
    name: "可用性"
    subcategories:
      - id: "A.1"
        name: "継続性"
        items:
          - id: "A.1.1"
            name: "運用スケジュール"
            important: true
            metrics:
              - id: "A.1.1.1"
                name: "運用時間（通常）"
                important: true
                grade: 3
                grade_description: "1時間程度の停止（9時〜翌8時）"
                reason: "BUC「予約管理」が営業時間外も利用される想定のため"
                source_model: "BUC: 予約管理"
                confidence: "high | medium | low"
              - id: "A.1.1.2"
                name: "運用時間（特定日）"
                important: false
                grade: 0
                grade_description: "規定なし"
                reason: "モデルシステムデフォルト適用"
                source_model: null
                confidence: "default"
```

## フィールド説明

### トップレベル

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| version | string | Yes | スキーマバージョン（"1.0"固定） |
| event_id | string | Yes | イベントID（イベントソーシング用） |
| created_at | string | Yes | 作成日時（ISO 8601） |
| source | string | Yes | トリガーの説明 |

### model_system

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| type | string | Yes | "model1", "model2", "model3" のいずれか |
| reason | string | Yes | 選定根拠 |

### categories

6大項目の配列。A〜F の順序で格納する。

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | 大項目ID（"A"〜"F"） |
| name | string | Yes | 大項目名 |
| subcategories | array | Yes | 中項目の配列 |

### subcategories

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | 中項目ID（"A.1"形式） |
| name | string | Yes | 中項目名 |
| items | array | Yes | 小項目の配列 |

### items

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | 小項目ID（"A.1.1"形式） |
| name | string | Yes | 小項目名 |
| important | boolean | Yes | 重要項目フラグ |
| metrics | array | Yes | メトリクスの配列 |

### metrics

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | string | Yes | メトリクスID（"A.1.1.1"形式） |
| name | string | Yes | メトリクス名 |
| important | boolean | Yes | 重要項目フラグ |
| grade | integer | Yes | 決定レベル（0〜5） |
| grade_description | string | Yes | 確定レベルの具体的な内容（例: "1時間程度の停止（9時〜翌8時）"、"~1,000"）。nfr-grade-catalog.md のレベル定義から該当する内容を転記する |
| reason | string | Yes | レベル決定根拠 |
| source_model | string | null | Yes | 根拠となった RDRA モデル要素（推論元）。推論不能の場合は null |
| confidence | string | Yes | 確信度: "high"=RDRA から明確に推論, "medium"=RDRA から間接推論, "low"=弱い推論, "default"=モデルシステムデフォルト, "user"=ユーザー指定 |

## ID 体系

| レベル | 形式 | 例 |
|--------|------|-----|
| 大項目 | {A-F} | A |
| 中項目 | {大項目}.{連番} | A.1 |
| 小項目 | {中項目}.{連番} | A.1.1 |
| メトリクス | {小項目}.{連番} | A.1.1.1 |

## confidence 値の使い分け

| 値 | 意味 | Step2 での扱い |
|----|------|---------------|
| high | RDRA モデルから明確に推論できた | 確認のみ（変更不要なら省略可） |
| medium | RDRA モデルから間接的に推論した | 確認を推奨 |
| low | 弱い根拠での推論 | 必ず確認 |
| default | モデルシステムのデフォルト値を適用 | 必要に応じて確認 |
| user | ユーザーが対話で指定した値 | 確定済み |

## ディレクトリ配置

```
docs/nfr/
  events/
    {event_id}/
      nfr-grade.yaml       # この変更での NFR グレード
      _inference.md         # 推論根拠サマリ
      source.txt            # トリガー説明のコピー
  latest/
    nfr-grade.yaml          # 最新スナップショット
```
