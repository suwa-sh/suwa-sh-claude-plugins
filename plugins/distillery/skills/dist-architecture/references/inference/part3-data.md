# Part 3: データアーキテクチャ推論ルール

> **読み込みタイミング**: Step1 の Part 3（データ）推論 subagent だけが読む。基本方針・入力ファイル表・Part 索引は `references/arch-inference-rules.md`。

データアーキテクチャの設計方針・イミュータブルデータモデルの詳細は `arch-data-patterns.md` を参照。

### エンティティ分類ルール

情報.tsv の各エンティティを、状態.tsv との対応に基づいて分類する。

| 判定条件 | 分類 | テーブル設計 | confidence |
|---------|------|-----------|-----------|
| 状態.tsv に対応する状態モデルがある | event_snapshot | {entity}_events（INSERT のみ）+ {entity}_snapshots（最新状態キャッシュ） | high |
| 個人情報（氏名・連絡先等）があり変更履歴の追跡が一般的 | event_snapshot | 同上。属性変更イベントを記録し、スナップショットで最新状態を保持 | medium |
| 「〜する」動詞で表現でき、発生日時を持ち、登録後に変更しない | event | {entity} テーブル（INSERT のみ）。スナップショット不要 | high |
| 金銭関連（金額・料金属性）で一度きりの記録 | event | 同上。金額を含む不変の事実記録 | high |
| 状態モデルなし + 属性変更が想定され世代管理が必要なマスタ | resource_scd2 | valid_from / valid_to で世代管理 | medium |
| 単純なマスタ・設定、上記いずれにも該当しない | resource_mutable | 従来型のテーブル | default |

event_snapshot 型のエンティティでは:
- nullable な日時属性（〜日時、〜日）は排除し、イベントの occurred_at で管理する
- current_status 属性はスナップショットテーブルに持たせる（キャッシュ的ステータス）
- repository 層が「イベント追記 + スナップショット更新」の二重書き込みを隠蔽する（historyAdapter.insert + snapshotAdapter.upsert）

event 型のエンティティでは:
- INSERT のみのテーブル。UPDATE/DELETE 禁止
- スナップショットテーブルは不要
- nullable 属性は原則なし（全属性が INSERT 時に確定）

### エンティティ抽出ルール

情報.tsv の各行を1エンティティとして抽出する。

| 情報.tsv カラム | マッピング先 | ルール |
|----------------|------------|--------|
| 情報（名前） | Entity.name | そのまま使用 |
| 属性 | Entity.attributes | カンマ区切りまたは読点（、）区切りで分割し、各属性を Attribute に変換 |
| 関連情報 | Entity.relationships | 参照先のエンティティを特定し、Relationship を生成 |
| 状態モデル | 追加属性: status | 状態モデルがある場合、string 型の status 属性を追加 |
| バリエーション | 追加属性: type/category | バリエーションがある場合、分類属性を追加 |

### 属性の型推論ルール

情報.tsv の属性名から論理型を推論する。

| 属性名パターン | 推論型 | confidence |
|---------------|--------|-----------|
| *ID, *id, *コード | string | high |
| *名, *名称, *氏名 | string | high |
| *日, *日時, *日付 | datetime（Event+Snapshot 型の場合は nullable 日時を排除し、イベントの occurred_at で管理） | high |
| *時間, *時刻 | datetime | high |
| *数, *量, *回数 | integer | high |
| *額, *金額, *料金, *率 | decimal | high |
| *フラグ, *可否, *有無 | boolean | high |
| *スコア, *点数, *評価 | decimal | medium |
| *メール, *電話, *住所, *URL | string | high |
| *内容, *コメント, *説明 | text | high |
| *画像, *ファイル | string (URI) | medium |
| *ステータス, *状態 | string (enum) | high |
| その他 | string | low |

### リレーション推論ルール

| 情報.tsv の関連情報パターン | カーディナリティ | confidence |
|---------------------------|----------------|-----------|
| A が B を「所有」「管理」する関係 | A 1:N B | medium |
| A が B に「属する」「紐づく」関係 | A N:1 B | medium |
| A と B が「参照」関係 | A N:1 B or 1:1 | low |
| 中間テーブル的な情報が存在 | N:M | low |

リレーションの推論は曖昧さが大きいため、confidence は medium 以下。Step2 で確認する。

### セッション・キャッシュエンティティ生成ルール

| 判定条件 | 推論結果 | confidence |
|---------|---------|-----------|
| 外部アクター + OAuth2/OIDC 認証 | セッション情報エンティティを生成（session_id, user_id, access_token, refresh_token, role, expires_at）、ストレージ: cache | high |
| NFR B（性能）でレスポンス要件あり + 検索系 UC あり | 対象エンティティに cache ストレージマッピングを追加（RDB との二重マッピング） | medium |
| 参照頻度が高いマスタデータ（運用ルール等） | 対象エンティティに cache ストレージマッピングを追加 | medium |

### ストレージマッピング推論ルール

| 判定条件 | ストレージ種別 | confidence |
|---------|-------------|-----------|
| 金銭・取引・予約に関するエンティティ | rdb | high |
| 状態モデルを持つエンティティ | rdb | high |
| 複数エンティティとの外部キー関係 | rdb | medium |
| 画像・ファイル属性を持つエンティティ | file (Object Storage) | medium |
| NFR B（性能）で頻繁に参照されるマスタデータ | cache (KVS) + rdb（→ Cache-Aside パターン参照: arch-design-patterns.md） | medium |
| 全文検索が必要なエンティティ | search + rdb | low |
| ログ・履歴系でトランザクション不要 | nosql | low |
| 上記いずれにも該当しない | rdb | default |

補足: Event テーブルと Snapshot テーブルは同一ストレージ（RDB）に配置する。repository 層が gateway/adapter を経由してイベント追記とスナップショット更新の二重書き込みを1トランザクションで実行する。

---
