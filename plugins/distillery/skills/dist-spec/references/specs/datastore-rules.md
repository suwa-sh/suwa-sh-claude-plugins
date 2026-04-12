# データストアレイアウト生成ルール

> **読み込みタイミング**: Step3/Step4b で使用。データストアレイアウト統合ルール。

UC 単位の `_model-summary.yaml` を統合し、全体横断のデータストアレイアウト YAML を生成する。

## 生成条件

arch-design.yaml の `system_architecture.tiers` でデータストア系ティアが定義されている場合に生成する:
- `tier-datastore-rdb` → `rdb-schema.yaml`
- `tier-datastore-kvs` → `kvs-schema.yaml`
- `tier-datastore-objectstorage` → `object-storage-schema.yaml`

## UC 単位: _model-summary.yaml

### 出力タイミング

Step3 の UC Spec 生成時に、`_api-summary.yaml` と同じディレクトリに出力する。
spec.md のデータフロー（mermaid + データ変換テーブル）と tier-backend-api.md のデータモデル変更セクションから導出する。

### スキーマ

```yaml
uc: "{UC名}"
business: "{業務名}"
buc: "{BUC名}"

# レイヤーごとのモデル定義
models:
  - name: "{モデル/型名}"
    tier: "{ティアID}"
    layer: "{レイヤー名}"       # view, state, api-client, presentation, usecase, domain, gateway
    type: "{モデル種別}"        # view-model, state, request, request-dto, command, query, entity, value-object, record
    rdra_info: "{情報.tsv の情報名}"  # RDRA 情報モデルとの紐付け（該当する場合）

# RDB テーブルアクセス
tables:
  - name: "{テーブル名}"
    rdra_info: "{情報.tsv の情報名}"
    operations:                 # このUCが行うCRUD
      - type: "INSERT"         # INSERT / SELECT / UPDATE / DELETE
        columns:               # 操作対象カラム（INSERT/UPDATE時）
          - name: "{カラム名}"
            value: "{設定値の説明}"  # 固定値がある場合（例: status=申請）
        where: ""              # SELECT/UPDATE/DELETE時の条件
      - type: "SELECT"
        columns: []
        where: "{WHERE句の概要}"
    indexes_needed:            # このUCのアクセスパターンから必要なインデックス
      - columns: ["{カラム名}"]
        reason: "{必要な理由}"
        access_pattern: "{アクセスパターンの説明}"

# KVS アクセス（該当する場合）
kvs:
  - key_pattern: "{キーパターン}"   # 例: "session:{user_id}", "cache:room:{room_id}"
    purpose: "{用途}"               # session, cache, rate-limit, lock 等
    value_type: "{値の型概要}"
    ttl: "{TTL}"                    # 例: "15m", "1h", "24h"
    operations: ["GET", "SET"]      # GET / SET / DEL / INCR 等

# Object Storage アクセス（該当する場合）
object_storage:
  - path_pattern: "{パスパターン}"  # 例: "rooms/{room_id}/images/{image_id}.jpg"
    purpose: "{用途}"
    content_type: "{MIMEタイプ}"
    operations: ["PUT", "GET"]      # PUT / GET / DELETE
    max_size: "{最大サイズ}"        # 例: "10MB"
```

### 導出ルール

1. **models**: spec.md のデータフロー mermaid のノード名から抽出。入れ子 subgraph のティア/レイヤー構造からtier/layerを決定
2. **tables**: tier-backend-api.md のデータモデル変更セクション + spec.md のデータフローの SQL 概要から導出
3. **rdra_info**: 情報.tsv の情報名と照合。Reservation → 予約情報、Room → 会議室情報 等
4. **indexes_needed**: tier-backend-api.md の API 仕様の検索条件（クエリパラメータ）や spec.md の分岐条件一覧から導出
5. **kvs**: arch-design.yaml で KVS が定義されている場合に、セッション管理・キャッシュ・レート制限等のアクセスパターンを記述
6. **object_storage**: 画像アップロード等のファイル操作がある UC のみ記述

## 全体横断: rdb-schema.yaml

### 統合手順

1. 全 UC の `_model-summary.yaml` の `tables` セクションを収集する
2. 同名テーブルをマージし、全 UC のカラム・操作を集約する
3. 情報.tsv の属性からカラム定義（名前、型、制約）を導出する
4. 情報.tsv の「関連情報」列からテーブル間の FK を導出する
5. 各 UC の `indexes_needed` を集約し、重複を排除してインデックス一覧を生成する

### スキーマ

```yaml
version: "1.0"
datastore: "rdb"

tables:
  - name: "{テーブル名}"
    rdra_info: "{情報.tsv の情報名}"
    description: "{テーブルの説明}"
    columns:
      - name: "{カラム名}"
        type: "{データ型}"          # string, integer, bigint, decimal, boolean, date, datetime, text, uuid
        nullable: false             # true / false
        default: "{デフォルト値}"    # 省略可
        description: "{説明}"
    primary_key: ["{カラム名}"]
    foreign_keys:
      - columns: ["{カラム名}"]
        references:
          table: "{参照先テーブル名}"
          columns: ["{参照先カラム名}"]
        on_delete: "CASCADE"        # CASCADE / SET NULL / RESTRICT / NO ACTION
    indexes:
      - name: "{インデックス名}"
        columns: ["{カラム名}"]
        unique: false
        reason: "{必要な理由}"
        used_by: ["{UC名}"]         # このインデックスを必要とするUC一覧
    used_by:                        # このテーブルを使うUC一覧
      - uc: "{UC名}"
        operations: ["INSERT", "SELECT"]

# テーブル間の関連図（mermaid ER図）
er_diagram: |
  erDiagram
    {テーブルA} ||--o{ {テーブルB} : "{関連名}"
```

### 型マッピングルール

RDRA 情報モデルの属性からの型推定:

| 属性パターン | 推定型 | 例 |
|------------|-------|---|
| *ID | uuid | オーナーID, 会議室ID |
| *名, *先, *内容 | string | 氏名, 所在地, 問合せ内容 |
| *日, *日時 | datetime | 登録日, 予約日時 |
| *料, *額, *金額, *単価 | decimal | 利用料金, 精算額 |
| *数, *人数 | integer | 収容人数, 利用回数 |
| *率 | decimal | キャンセル料率, 手数料率 |
| *状態, *可否 | string (enum) | 予約状態, 貸出可否 |
| *スコア | decimal | 評価スコア |
| *メール* | string | メールアドレス |
| *URL* | string | 会議URL |
| *フラグ, *可否 | boolean | 録画可否 |

## 全体横断: kvs-schema.yaml

```yaml
version: "1.0"
datastore: "kvs"

key_patterns:
  - pattern: "{キーパターン}"
    purpose: "{用途}"
    value_type: "{値の型概要}"
    ttl: "{TTL}"
    used_by: ["{UC名}"]
    description: "{説明}"
```

## 全体横断: object-storage-schema.yaml

```yaml
version: "1.0"
datastore: "object-storage"

buckets:
  - name: "{バケット名}"
    description: "{説明}"
    paths:
      - pattern: "{パスパターン}"
        content_type: "{MIMEタイプ}"
        max_size: "{最大サイズ}"
        used_by: ["{UC名}"]
        description: "{説明}"
    lifecycle:
      expiration_days: null         # 自動削除日数（null = 無期限）
```

## インデックス品質ルール

インデックスの品質が低い（名前なし、説明なし、ユニーク制約の検討不足）と実装時に混乱を招く。以下を必ず守る:

### インデックス命名規則

- 一意性インデックス: `uq_{テーブル名}_{カラム名1}_{カラム名2}` (例: `uq_reservations_room_id_start_at`)
- 検索用インデックス: `idx_{テーブル名}_{カラム名1}_{カラム名2}` (例: `idx_rooms_owner_id_status`)
- 外部キーインデックス: `fk_{テーブル名}_{参照先テーブル名}` (例: `fk_reservations_rooms`)
- 名前は **必ず** 設定する（空欄禁止）

### ユニーク制約の検討

各テーブルについて以下を必ず検討し、`unique: true` のインデックスを設定する:

- **自然キー**: メールアドレス、電話番号、外部システムID等の一意であるべきカラム
- **複合ユニーク**: 同一リソースの重複防止（例: 同じ会議室の同時間帯予約、同一ユーザーの同一対象への重複評価）
- **ビジネスルール由来**: RDRA の条件.tsv やバリエーション.tsv から導出される一意性制約
- **状態遷移の整合性**: アクティブ状態のレコードに対するユニーク制約（例: `WHERE status = 'active'` の部分インデックス）

検討結果は `indexes` の `reason` フィールドに「ユニーク制約: {理由}」として記録する。ユニーク制約が不要と判断した場合もその理由を `_review_notes` に記録する。

### 各カラムの description 必須

- すべてのカラムに `description` を設定する（空欄禁止）
- description にはカラムの用途・制約・RDRA 情報モデルとの対応を記述する
- enum 型カラムでは取りうる値を列挙する（例: `"予約状態。値: pending, confirmed, cancelled, completed"`）

## 注意事項

- YAML で留める。DDL (SQL) には変換しない（方言の問題を回避）
- データ型は抽象型（string, integer, decimal 等）を使い、RDB 製品固有の型名は避ける
- インデックスは必要な理由と対応 UC を明記する（不要なインデックスを防ぐ）
- KVS のキーパターンはプレースホルダ `{変数名}` を使う
- テーブル名は snake_case の複数形（英語）
- カラム名は snake_case（英語）
- KVS キーパターンは統合時に重複を排除する
- KVS キー命名は `{目的}:{種別}:{識別子}` のコロン区切り階層にする（例: `session:user:{user_id}`, `session:owner:{owner_id}`, `cache:room:{room_id}`）。同じ目的のキーを `{目的}:*` でスキャンできる。キー名だけで用途が読み取れるようにする
