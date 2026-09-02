# tier-{tier_id}.md フォーマット（API / バックエンド系ティア）

> **読み込みタイミング**: Step3 の UC Spec 生成 subagent が、対象ティアの kind に一致するファイル**だけ**を読む
> （kind はオーケストレータが Step1 で確定し、subagent 指示の「対象ティア」に `(kind)` として渡す）。
> 共通部（spec.md フォーマット・注意事項）は `references/specs/spec-template.md`。

API / バックエンド系ティア（REST API, GraphQL, gRPC など）の場合に使用する。
該当判定: `tiers[].technology_candidates` に REST, GraphQL, gRPC, API Gateway 等の API 技術が含まれる場合。

```markdown
# {UC名} - {ティア名}仕様

## 変更概要

{このティアで必要な変更の概要}

## API 仕様

### {API名}

- **メソッド**: GET/POST/PUT/DELETE
- **パス**: {APIパス}
- **認証**: {認証方式}
- **OpenAPI**: [openapi.yaml](../../_cross-cutting/api/openapi.yaml) の `paths.{パス}.{メソッド}` を参照

#### リクエスト

| パラメータ | 型 | 必須 | 説明 |
|-----------|---|------|------|
| {パラメータ名} | string/number/boolean | Yes/No | {説明} |

#### レスポンス

| フィールド | 型 | 説明 |
|-----------|---|------|
| {フィールド名} | string/number/boolean | {説明} |

#### エラーレスポンス

| ステータスコード | 条件 | レスポンス |
|----------------|------|-----------|
| 400 | {バリデーションエラー条件} | {エラーメッセージ} |
| 404 | {リソース未存在条件} | {エラーメッセージ} |

## 非同期イベント（該当する場合）

### {イベント名}

- **チャネル**: {メッセージキュー/トピック名}
- **方向**: publish/subscribe
- **AsyncAPI**: [asyncapi.yaml](../../_cross-cutting/api/asyncapi.yaml) の `channels.{チャネル名}` を参照

## データモデル変更

### {テーブル/エンティティ名}

| カラム | 型 | 説明 | 変更種別 |
|--------|---|------|---------|
| {カラム名} | VARCHAR/INT/... | {説明} | 追加/変更/削除 |

## ビジネスルール

- {ビジネスルール1}
- {ビジネスルール2}

## ティア完了条件（BDD）

```gherkin
Feature: {UC名} - {ティア名}

  Scenario: {APIシナリオ}
    Given {前提条件}
    When {APIリクエスト}
    Then {APIレスポンス}
```
```
