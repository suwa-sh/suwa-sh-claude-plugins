# 決定候補カタログ: データストアと migration

エンティティの分類・ストレージ種別・保持方針・スキーマ移行を決める。ADR の `scope: [data]`。

---

## エンティティ分類

- **選択肢**: event_snapshot / event / resource_scd2 / resource_mutable
- **判定**:
  - 状態モデルを持つ → **event_snapshot** (`{entity}_events` は INSERT のみ + `{entity}_snapshots`)。個人情報で履歴追跡が要るものも event_snapshot。
  - 「〜する」動詞 + 発生日時 + 登録後不変 → **event** (INSERT のみ、スナップショット不要)。金銭の一度きりの記録も event。
  - 属性変更 + 世代管理が要るマスタ → **resource_scd2** (valid_from / valid_to)。
  - それ以外の単純マスタ → **resource_mutable** (デフォルト)。
- **派生するルール例**:
  ```yaml
  - scope: tier:backend
    text: "event_snapshot エンティティは events テーブルへ追記し、物理更新・物理削除をしない"
  ```

## ストレージ種別

- **選択肢**: rdb / cache(KVS) / file(Object Storage) / search / nosql
- **判定**:
  - 金銭 / 取引 / 予約・状態モデル・外部キーが多い → **rdb** (デフォルト)。
  - 画像 / ファイル属性 → **file** (Object Storage)。
  - 頻繁参照マスタ → **cache + rdb** (Cache-Aside)。
  - 全文検索 → **search + rdb**。
  - ログ / 履歴でトランザクション不要 → **nosql**。
- event と snapshot は同一 RDB に置き、repository が二重書き込みを 1 トランザクションで隠す。

## 保持方針 / 監査

- イミュータブル方針: 物理削除せず、訂正イベント・論理削除イベントで表現する。
- 完全履歴が規制で要る (金融 / 医療) → Event Sourcing を**限定適用** (状態遷移 8 種以上 + 監査要件)。全エンティティへの無差別適用はアンチパターン。

## migration

- スキーマは移行ファイル (DDL) で管理し、後段の d2-contract が DB 契約から生成する。サンプルは pglite で検証 (docker 不要)。
- レガシー連携は Anti-Corruption Layer、段階移行は Strangler Fig (NFR D 移行性)。
- **派生するルール例**:
  ```yaml
  - scope: tier:backend
    text: "スキーマ変更は migration ファイルの追加で行い、既存 migration を書き換えない"
  ```
