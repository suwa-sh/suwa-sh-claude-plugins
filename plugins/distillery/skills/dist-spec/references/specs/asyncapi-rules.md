# AsyncAPI Spec 生成ルール

> **読み込みタイミング**: Step4a で使用。AsyncAPI 3.0 生成ルール。

非同期メッセージイベントの仕様を AsyncAPI 3.0 形式で記述する。

## 生成条件

以下のいずれかに該当する場合に生成する:

1. RDRA の外部システム連携で非同期メッセージングが必要な場合
2. 状態遷移の通知イベントが必要な場合
3. arch-design.yaml で message_queue, event_bus, pub_sub が定義されている場合
4. 複数サービス間のイベント駆動連携がある場合

## 基本構造

```yaml
asyncapi: "3.0.0"
info:
  title: "{UC名} Async Events"
  version: "1.0.0"
  description: "{UC の非同期イベント概要}"
servers:
  default:
    host: "{arch-design.yaml の message broker ホスト}"
    protocol: "{amqp/kafka/mqtt/nats 等}"
    description: "{環境名}"
channels:
  {チャネル定義}
operations:
  {オペレーション定義}
components:
  messages:
    {メッセージ定義}
  schemas:
    {スキーマ定義}
```

## チャネル定義ルール

### チャネル命名

- ドット区切り: `{ドメイン}.{エンティティ}.{イベント種別}`
- 例: `booking.reservation.created`, `notification.email.send`

### イベント種別

| RDRA 操作 | イベント種別 | 説明 |
|-----------|-----------|------|
| 作成 | created | リソース作成イベント |
| 更新 | updated | リソース更新イベント |
| 削除 | deleted | リソース削除イベント |
| 状態遷移 | {状態名}_changed | 状態遷移イベント |
| 通知 | notification | 通知送信イベント |
| 外部連携 | sync | 外部システム同期イベント |

## メッセージ定義ルール

```yaml
components:
  messages:
    {メッセージ名}:
      name: "{メッセージ名}"
      title: "{メッセージタイトル}"
      summary: "{概要}"
      contentType: "application/json"
      payload:
        $ref: "#/components/schemas/{PayloadSchema}"
      headers:
        type: object
        properties:
          correlationId:
            type: string
            description: "リクエスト追跡ID"
          timestamp:
            type: string
            format: date-time
          source:
            type: string
            description: "イベント発生元サービス"
```

## スキーマ定義ルール

RDRA 情報モデルから導出する。OpenAPI と同じ型マッピングを使用する。

### 共通ヘッダー

すべてのイベントメッセージに以下のヘッダーを含める:

| フィールド | 型 | 説明 |
|-----------|---|------|
| correlationId | string (uuid) | リクエスト追跡ID |
| timestamp | string (date-time) | イベント発生日時 |
| source | string | イベント発生元 |
| eventType | string | イベント種別 |
| version | string | メッセージスキーマバージョン |

## オペレーション定義

```yaml
operations:
  {オペレーション名}:
    action: send / receive
    channel:
      $ref: "#/channels/{チャネル名}"
    summary: "{操作の概要}"
    messages:
      - $ref: "#/channels/{チャネル名}/messages/{メッセージ名}"
```

## arch-design.yaml との整合

- `technology_context.messaging` からプロトコルを決定する
- `system_architecture.tiers` から publish/subscribe のサービス配置を決定する
- `app_architecture.layers.event` があればイベント処理レイヤーの設計を参照する
