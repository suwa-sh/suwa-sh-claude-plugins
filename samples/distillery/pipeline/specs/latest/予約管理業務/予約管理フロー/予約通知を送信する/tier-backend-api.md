# 予約通知を送信する - バックエンドAPI仕様

## 変更概要

予約通知を送信するの API エンドポイントを実装する。

## API 仕様


#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | バリデーションエラー | RFC 7807 Problem Details |
| 401 | 未認証 | RFC 7807: title="Unauthorized" |
| 403 | 権限なし | RFC 7807: title="Forbidden" |
| 404 | リソース未存在 | RFC 7807: detail="リソースが見つかりません" |

## 非同期イベント

### 予約確保通知メール送信

- **チャネル**: reservation-notification-queue
- **方向**: subscribe
- **メッセージスキーマ**: ReservationNotificationMessage


## データモデル変更

関連テーブル: 予約, 利用者

## ビジネスルール

- RDRA定義の条件に基づく処理

## ティア完了条件（BDD）

```gherkin
Feature: 予約通知を送信する - バックエンドAPI

  Scenario: 正常なAPIリクエスト
    Given 認証済みのアクセストークンが有効
    When APIリクエストを送信する
    Then 正常なレスポンスが返却される
```
