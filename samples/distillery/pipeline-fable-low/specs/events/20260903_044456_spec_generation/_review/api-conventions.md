# API 規約の正本（Step3 横断修正用）

event: 20260903_044456_spec_generation。全 UC の `_api-summary.yaml` / `tier-backend-api.md` / `tier-frontend-*.md` / `tier-worker.md` / `spec.md` の API 記述はこの規約に揃える。

## パス

- すべての API パスは `/api/v1/` プレフィックスを付ける（例 `/api/v1/loans`、`/api/v1/me/loans`）。
- リソース名は複数形 kebab-case、パスパラメータは `{resourceId}` camelCase（`{userNumber}` は既存どおり）。
- JSON フィールドは camelCase。

## enum（API スキーマ・非同期メッセージスキーマ）

英語 UPPER_SNAKE_CASE を値とし、description に RDRA の日本語表記を併記する。

| 対象 | 値（順序 = RDRA 状態.tsv / バリエーション.tsv） |
|------|------|
| 書籍状態 `bookStatus` | AVAILABLE（在庫あり）/ ON_LOAN（貸出中）/ RESERVED（予約待ち） |
| 媒体種別 `mediaType` | PAPER（紙）/ ELECTRONIC（電子） |
| 利用者区分 `userType` | PATRON（利用者）/ STAFF（司書） |
| 貸出状態 `loanStatus` | ON_LOAN（貸出中）/ OVERDUE（延滞）/ RETURNED（返却済み） |
| 予約状態 `reservationStatus` | RESERVED（予約中）/ NOTIFIED（通知済み）/ CANCELLED（取消）/ CLOSED（終了） |
| 通知種別 `notificationType` | RETURN_NOTICE（返却通知）/ REMINDER（返却期限リマインド）/ OVERDUE_NOTICE（延滞督促） |
| 送信結果 `sendResult` | PENDING（送信待ち）/ SUCCEEDED（成功）/ FAILED（失敗）/ SKIPPED（スキップ） |
| 集計期間種別 `periodType` | DAY（日）/ MONTH（月）/ YEAR（年） |
| イベント種別 `event_type`（*_events テーブル格納値） | REGISTERED（登録）/ UPDATED（更新）/ DELETED（削除）/ LOANED（貸出）/ RETURNED（返却）/ OVERDUE（延滞）/ RESERVED（予約）/ NOTIFIED（通知）/ CANCELLED（取消）/ CLOSED（終了） |

- RDB カラムの格納値も同じ英語コードに揃える（`_model-summary.yaml` の enum 記述・tier-backend-api.md のデータモデル）。
- 画面表示ラベルは日本語のまま（tier-frontend-*.md の表示マッピングで英語コード → 日本語ラベルを対応づける）。

## エラー

- RFC 9457 `application/problem+json`。`type` / `title` / `status` / `detail` / `instance` + 拡張 `code`（業務エラーコード UPPER_SNAKE_CASE）/ `traceId`。
- 400 入力不正 / 401 未認証 / 403 権限 / 404 不在 / 409 業務ルール違反・楽観ロック競合 / 422 検証。

## ページネーション

- `page`（1 始まり）/ `pageSize`（既定 20、上限 100）、レスポンスに `items[]` / `page` / `pageSize` / `totalCount`。

## 同一パスの共有

- 同一パス・メソッドは全 UC で同じスキーマ名を使う（`GET /api/v1/books/{bookId}` → `BookDetailResponse`（UC 側の `BookResponse` は統合時に本名へ改名）、`GET /api/v1/books` → `BookPageResponse`、`GET /api/v1/users/{userNumber}` → `UserResponse`）。
