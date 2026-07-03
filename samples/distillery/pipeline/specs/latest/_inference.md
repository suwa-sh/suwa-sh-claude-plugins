# Spec 生成 分析根拠

## 分析日時
2026-04-12T19:55:42

## システム名
- 英語名（API/コード）: LibraShelf（design-event.yaml brand.name）
- 和名（仕様書/UI）: 図書館蔵書管理システム（システム概要.json system_name）

## UC 一覧（16 UC / 6 業務 / 8 BUC）

```
蔵書管理業務
  └── 蔵書管理フロー
        ├── 書籍を登録する
        ├── 書籍情報を編集する
        └── 書籍を削除する

貸出管理業務
  ├── 貸出管理フロー
  │     ├── 書籍を貸出する
  │     ├── 書籍を返却する
  │     └── 貸出状況を確認する
  └── 延滞管理フロー
        ├── 延滞を検出する
        └── 督促通知を送信する

予約管理業務
  └── 予約管理フロー
        ├── 書籍を予約する
        ├── 予約通知を送信する
        └── 予約をキャンセルする

利用者管理業務
  └── 利用者管理フロー
        ├── 利用者を登録する
        └── 利用者情報を編集する

閲覧業務
  ├── 蔵書検索フロー
  │     └── 書籍を検索する
  └── 利用者マイページフロー
        ├── 貸出履歴を確認する
        └── 予約状況を確認する

統計業務
  └── 統計・レポートフロー
        ├── 在庫状況を確認する
        └── 統計レポートを閲覧する
```

## UC-ティアマッピング

arch-design.yaml の tiers:
- tier-frontend: フロントエンド（SSR / Presentation 系）
- tier-backend-api: バックエンド API（FaaS / API 系）
- tier-worker: バックエンドワーカー（CronJob + MQ / 非同期処理系）
- tier-datastore: データストア（インフラ → UC 単位では生成しない）
- tier-external: 外部連携（インフラ → UC 単位では生成しない）

| UC名 | パターン | アクター | tier-frontend | tier-backend-api | tier-worker |
|------|---------|---------|---------------|-----------------|-------------|
| 書籍を登録する | 画面あり（社内） | 司書 | admin | o | - |
| 書籍情報を編集する | 画面あり（社内） | 司書 | admin | o | - |
| 書籍を削除する | 画面あり（社内） | 司書 | admin | o | - |
| 書籍を貸出する | 画面あり（社外） | 利用者 | user | o | - |
| 書籍を返却する | 画面あり（社外） | 利用者 | user | o | - |
| 貸出状況を確認する | 画面あり（社内） | 司書 | admin | o | - |
| 延滞を検出する | バッチ+画面（社内） | 司書 | admin | o | o（CronJob） |
| 督促通知を送信する | 自動通知+外部連携 | - | - | o | o（MQ） |
| 書籍を予約する | 画面あり（社外） | 利用者 | user | o | - |
| 予約通知を送信する | 自動通知+外部連携 | - | - | o | o（MQ） |
| 予約をキャンセルする | 画面あり（社外） | 利用者 | user | o | - |
| 利用者を登録する | 画面あり（社内） | 司書 | admin | o | - |
| 利用者情報を編集する | 画面あり（社内） | 司書 | admin | o | - |
| 書籍を検索する | 画面あり（社外） | 利用者 | user | o | - |
| 貸出履歴を確認する | 画面あり（社外） | 利用者 | user | o | - |
| 予約状況を確認する | 画面あり（社外） | 利用者 | user | o | - |
| 在庫状況を確認する | 画面あり（社内） | 司書 | admin | o | - |
| 統計レポートを閲覧する | 画面あり（社内） | 司書 | admin | o | - |

## UC-画面マッピング

| UC名 | RDRA画面 | Design画面 | ポータル | コンポーネント |
|------|---------|-----------|---------|-------------|
| 書籍を登録する | 蔵書登録画面 | 蔵書登録画面 | admin | Input, Button |
| 書籍情報を編集する | 蔵書編集画面 | 蔵書編集画面 | admin | Input, Button |
| 書籍を削除する | 蔵書管理画面 | 蔵書管理画面 | admin | BookCard, BookLoanStatusBadge, BookSearchFilter, Button |
| 書籍を貸出する | 貸出手続き画面 | 貸出手続き画面 | user | BookCard, BookLoanStatusBadge, Button |
| 書籍を返却する | 返却手続き画面 | 返却手続き画面 | user | LoanRecord, Button |
| 貸出状況を確認する | 貸出状況一覧画面 | 貸出状況一覧画面 | admin | LoanRecord, BookLoanStatusBadge |
| 延滞を検出する | 延滞管理画面 | 延滞管理画面 | admin | LoanRecord, BookLoanStatusBadge, Button |
| 督促通知を送信する | - | - | - | - |
| 書籍を予約する | 予約申請画面 | 予約申請画面 | user | BookCard, ReservationStatusBadge, Button |
| 予約通知を送信する | - | - | - | - |
| 予約をキャンセルする | 予約管理画面 | 予約管理画面 | user | ReservationStatusBadge, BookCard, Button |
| 利用者を登録する | 利用者登録画面 | 利用者登録画面 | admin | Input, Button |
| 利用者情報を編集する | 利用者編集画面 | 利用者編集画面 | admin | Input, Button |
| 書籍を検索する | 蔵書検索画面 | 蔵書検索画面 | user | BookSearchFilter, BookCard, BookLoanStatusBadge |
| 貸出履歴を確認する | 貸出履歴画面 | 貸出履歴画面 | user | LoanRecord, BookLoanStatusBadge |
| 予約状況を確認する | 予約状況画面 | 予約状況画面 | user | ReservationStatusBadge, BookCard |
| 在庫状況を確認する | 在庫状況画面 | 在庫状況画面 | admin | StatsSummaryCard, BookCard, BookLoanStatusBadge |
| 統計レポートを閲覧する | 統計レポート画面 | 統計レポート画面 | admin | StatsSummaryCard |

## API エンドポイント推定

| HTTP | パス | UC | 備考 |
|------|------|-----|------|
| POST | /api/v1/books | 書籍を登録する | |
| PUT | /api/v1/books/{id} | 書籍情報を編集する | |
| DELETE | /api/v1/books/{id} | 書籍を削除する | 在庫あり状態のみ |
| GET | /api/v1/books | 書籍を検索する | クエリパラメータでフィルター |
| GET | /api/v1/books/{id} | 書籍を検索する | 詳細取得 |
| POST | /api/v1/loans | 書籍を貸出する | 貸出可否判定+貸出期限設定 |
| PUT | /api/v1/loans/{id}/return | 書籍を返却する | |
| GET | /api/v1/loans | 貸出状況を確認する | 司書向け一覧 |
| GET | /api/v1/loans/overdue | 延滞を検出する | 延滞一覧取得 |
| POST | /api/v1/loans/detect-overdue | 延滞を検出する | バッチトリガー |
| POST | /api/v1/notifications/overdue | 督促通知を送信する | MQ 経由 |
| POST | /api/v1/reservations | 書籍を予約する | 予約優先ルール適用 |
| DELETE | /api/v1/reservations/{id} | 予約をキャンセルする | |
| POST | /api/v1/notifications/reservation | 予約通知を送信する | MQ 経由 |
| GET | /api/v1/reservations | 予約状況を確認する | 利用者向け |
| POST | /api/v1/users | 利用者を登録する | |
| PUT | /api/v1/users/{id} | 利用者情報を編集する | |
| GET | /api/v1/users/me/loans | 貸出履歴を確認する | マイページ向け |
| GET | /api/v1/users/me/reservations | 予約状況を確認する | マイページ向け |
| GET | /api/v1/inventory | 在庫状況を確認する | 集計データ |
| GET | /api/v1/stats | 統計レポートを閲覧する | 統計データ |

## 非同期イベント

| イベント名 | UC | チャネル | 方向 | メッセージ |
|-----------|-----|---------|------|---------|
| 督促メール送信 | 督促通知を送信する | overdue-notification-queue | publish | 貸出ID, 利用者ID, 書籍タイトル, 延滞日数 |
| 予約通知メール送信 | 予約通知を送信する | reservation-notification-queue | publish | 予約ID, 利用者ID, 書籍タイトル |

## 全体横断設計方針

### ユーザーフロー

**利用者フロー（社外）**:
1. 蔵書検索 → 書籍詳細確認
2. 書籍貸出申請 → 貸出完了
3. 書籍返却申請 → 返却完了
4. 書籍予約申請 → 予約受付 → （予約通知受信） → 貸出手続き
5. 予約キャンセル
6. マイページ: 貸出履歴確認、予約状況確認

**司書フロー（社内）**:
1. 蔵書登録 → 蔵書編集 → 蔵書削除
2. 利用者登録 → 利用者情報編集
3. 貸出状況確認
4. 延滞管理: 延滞検出 → 督促通知送信
5. 在庫状況確認、統計レポート閲覧

### 情報アーキテクチャ

**利用者ポータル（/）**:
- /books/search — 蔵書検索
- /loans/new — 貸出手続き
- /loans/return — 返却手続き
- /reservations/new — 予約申請
- /reservations — 予約管理
- /mypage/loans — 貸出履歴
- /mypage/reservations — 予約状況

**司書ポータル（/admin）**:
- /admin/books — 蔵書管理
- /admin/books/new — 蔵書登録
- /admin/books/:id/edit — 蔵書編集
- /admin/loans — 貸出状況一覧
- /admin/loans/overdue — 延滞管理
- /admin/users/new — 利用者登録
- /admin/users/:id/edit — 利用者編集
- /admin/inventory — 在庫状況
- /admin/stats — 統計レポート

### データ可視化対象

| 画面 | 可視化内容 | 指標 |
|------|---------|------|
| 統計レポート画面 | 貸出回数ランキング棒グラフ、期間別貸出推移折れ線グラフ | 貸出回数、人気書籍ランキング |
| 在庫状況画面 | 在庫状態別の円グラフ/ドーナツチャート | 在庫あり/貸出中/延滞中の比率 |

## NFR 反映事項

| NFR | 設計への影響 |
|-----|------------|
| A.1.1.1 運用時間 Lv2（9-21時） | ローディング/エラー状態、サービス停止告知バナー |
| B.1.1.1 同時アクセス Lv1（~100） | ページネーション 20件/ページ |
| B.2.1.1 レスポンスタイム Lv2（10秒） | Skeleton UI でパーシーブドパフォーマンス改善 |
| E.5.1.1 認証 Lv2（OAuth2/OIDC） | IdP Hosted UI に委譲 |
| E.5.2.1 認可 Lv2（RBAC） | 利用者/司書ロールでポータル分離 |
| E.1.2.1 PII保護 | 利用者情報マスク表示（司書のみ閲覧可） |
| CTP-005 冪等性 | 状態変更操作に X-Idempotency-Key ヘッダ |
