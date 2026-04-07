# OpenAPI 3.1 Spec 生成ルール

> **読み込みタイミング**: Step4a で使用。OpenAPI 3.1 生成ルール。

tier-backend.md の API 仕様と整合する OpenAPI 3.1 spec を生成する。

## フォーマット

YAML 形式（JSON ではない）で記述する。

## 基本構造

```yaml
openapi: "3.1.0"
info:
  title: "{UC名} API"
  version: "1.0.0"
  description: "{UC の概要}"
servers:
  - url: "{arch-design.yaml の API base URL}"
    description: "{環境名}"
paths:
  {エンドポイント定義}
components:
  schemas:
    {スキーマ定義}
  securitySchemes:
    {認証スキーマ}
security:
  - {デフォルト認証}
```

## パス定義ルール

### エンドポイント命名

- RESTful 規約に従う: `/api/v1/{リソース名}` 形式
- リソース名は複数形（英語）
- arch-design.yaml の app_architecture.layers.api から API 設計パターンを参照する

### メソッドマッピング

| RDRA 操作 | HTTP メソッド | パス例 |
|-----------|-------------|--------|
| 一覧表示 | GET | `/api/v1/resources` |
| 詳細表示 | GET | `/api/v1/resources/{id}` |
| 作成 | POST | `/api/v1/resources` |
| 更新 | PUT | `/api/v1/resources/{id}` |
| 部分更新 | PATCH | `/api/v1/resources/{id}` |
| 削除 | DELETE | `/api/v1/resources/{id}` |
| 検索 | GET | `/api/v1/resources?{条件}` |
| 状態遷移 | POST | `/api/v1/resources/{id}/actions/{action}` |

### レスポンス定義

各エンドポイントに以下のレスポンスを定義する:

```yaml
responses:
  "200":
    description: "成功"
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/{ResponseSchema}"
  "400":
    description: "バリデーションエラー"
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
  "401":
    description: "認証エラー"
  "403":
    description: "認可エラー"
  "404":
    description: "リソース未存在"
    content:
      application/json:
        schema:
          $ref: "#/components/schemas/ErrorResponse"
```

## スキーマ定義ルール

### RDRA 情報モデルからの導出

情報.tsv の属性をスキーマのプロパティにマッピングする:

| RDRA 属性型 | OpenAPI type | format |
|------------|-------------|--------|
| テキスト | string | - |
| 数値 | integer / number | - |
| 日付 | string | date |
| 日時 | string | date-time |
| フラグ | boolean | - |
| 選択肢 | string | - (enum で定義) |
| 金額 | number | - |
| メール | string | email |
| URL | string | uri |

### 共通スキーマ

```yaml
components:
  schemas:
    ErrorResponse:
      type: object
      required: [code, message]
      properties:
        code:
          type: string
        message:
          type: string
        details:
          type: array
          items:
            type: object
            properties:
              field:
                type: string
              message:
                type: string
    PaginatedResponse:
      type: object
      required: [items, total, page, per_page]
      properties:
        items:
          type: array
          items: {}
        total:
          type: integer
        page:
          type: integer
        per_page:
          type: integer
```

## セキュリティ定義

arch-design.yaml の認証方式に応じて定義する:

```yaml
components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

## バリデーション

- 条件.tsv のバリデーションルールを `required`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum` 等で表現する
- バリエーション.tsv の選択肢を `enum` で表現する

## サーバー URL

- `servers[].url` のドメイン名は design-event.yaml の `brand.name`（英語）から導出する（小文字化）
- 例: brand.name が `RoomConnect` → `api.roomconnect.example.com`
- `.example.com` は仕様ドキュメント用のプレースホルダ
- `info.title` には `brand.name` を使用する。`info.description` で和名（`brand.system_name_ja`）に言及してもよい

## NFR 反映

- 性能グレードに応じて一覧 API にページネーションパラメータ（page, per_page）を追加する
- セキュリティグレードに応じてセキュリティスキーマを設定する
