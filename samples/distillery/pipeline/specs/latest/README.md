# LibraShelf Spec - UC 一覧インデックス

イベント: `20260412_195542_spec_generation`

## UC 一覧

### 蔵書管理業務

- 蔵書管理フロー
  - [書籍を登録する](蔵書管理業務/蔵書管理フロー/書籍を登録する/spec.md)
  - [書籍情報を編集する](蔵書管理業務/蔵書管理フロー/書籍情報を編集する/spec.md)
  - [書籍を削除する](蔵書管理業務/蔵書管理フロー/書籍を削除する/spec.md)

### 貸出管理業務

- 貸出管理フロー
  - [書籍を貸出する](貸出管理業務/貸出管理フロー/書籍を貸出する/spec.md)
  - [書籍を返却する](貸出管理業務/貸出管理フロー/書籍を返却する/spec.md)
  - [貸出状況を確認する](貸出管理業務/貸出管理フロー/貸出状況を確認する/spec.md)
- 延滞管理フロー
  - [延滞を検出する](貸出管理業務/延滞管理フロー/延滞を検出する/spec.md)
  - [督促通知を送信する](貸出管理業務/延滞管理フロー/督促通知を送信する/spec.md)

### 予約管理業務

- 予約管理フロー
  - [書籍を予約する](予約管理業務/予約管理フロー/書籍を予約する/spec.md)
  - [予約通知を送信する](予約管理業務/予約管理フロー/予約通知を送信する/spec.md)
  - [予約をキャンセルする](予約管理業務/予約管理フロー/予約をキャンセルする/spec.md)

### 利用者管理業務

- 利用者管理フロー
  - [利用者を登録する](利用者管理業務/利用者管理フロー/利用者を登録する/spec.md)
  - [利用者情報を編集する](利用者管理業務/利用者管理フロー/利用者情報を編集する/spec.md)

### 閲覧業務

- 蔵書検索フロー
  - [書籍を検索する](閲覧業務/蔵書検索フロー/書籍を検索する/spec.md)
- 利用者マイページフロー
  - [貸出履歴を確認する](閲覧業務/利用者マイページフロー/貸出履歴を確認する/spec.md)
  - [予約状況を確認する](閲覧業務/利用者マイページフロー/予約状況を確認する/spec.md)

### 統計業務

- 統計レポートフロー
  - [在庫状況を確認する](統計業務/統計・レポートフロー/在庫状況を確認する/spec.md)
  - [統計レポートを閲覧する](統計業務/統計・レポートフロー/統計レポートを閲覧する/spec.md)

## 全体横断仕様

- [UX デザイン仕様](_cross-cutting/ux-ui/ux-design.md)
- [UI デザイン仕様](_cross-cutting/ux-ui/ui-design.md)
- [データ可視化設計仕様](_cross-cutting/ux-ui/data-visualization.md)
- [共通コンポーネント設計](_cross-cutting/ux-ui/common-components.md)
- [OpenAPI Spec](_cross-cutting/api/openapi.yaml)
- [AsyncAPI Spec](_cross-cutting/api/asyncapi.yaml)
- [RDB スキーマ](_cross-cutting/datastore/rdb-schema.yaml)
- [KVS スキーマ](_cross-cutting/datastore/kvs-schema.yaml)
- [データストア統合](_cross-cutting/datastore/datastore-schema.md)
- [トレーサビリティマトリクス](_cross-cutting/traceability-matrix.md)

## 設計判断記録

- [spec-decision-001: REST API スタイルの採用と命名規則](decisions/spec-decision-001.yaml)
- [spec-decision-002: 非同期イベント駆動パターンの採用範囲](decisions/spec-decision-002.yaml)
- [spec-decision-003: RDB 正規化レベルと統計テーブルの非正規化](decisions/spec-decision-003.yaml)
- [spec-decision-004: 横断関心事の解決方針](decisions/spec-decision-004.yaml)
