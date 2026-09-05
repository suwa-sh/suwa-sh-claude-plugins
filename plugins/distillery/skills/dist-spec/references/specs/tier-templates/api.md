# tier-{tier_id}.md フォーマット（API / バックエンド系ティア）

> **読み込みタイミング**: Step3 の UC Spec 生成 subagent が、対象ティアの kind に一致するファイル**だけ**を読む
> （kind はオーケストレータが Step1 で確定し、subagent 指示の「対象ティア」に `(kind)` として渡す）。
> 共通部（spec.md フォーマット・注意事項）は `references/specs/spec-template.md`。

API / バックエンド系ティア（REST API, GraphQL, gRPC など）の場合に使用する。
該当判定: `tiers[].technology_candidates` に REST, GraphQL, gRPC, API Gateway 等の API 技術が含まれる場合。

````markdown
# {UC名} - {ティア名}仕様

## 変更概要

{このティアで必要な変更の概要}

## API 仕様

### {API名}

- **メソッド**: GET/POST/PUT/DELETE
- **パス**: {APIパス}
- **operationId**: {全UCで一意なID}
- **認証**: {認証方式・許可するアクター/スコープ}
- **OpenAPI**: [openapi.yaml](../../../_cross-cutting/api/openapi.yaml) の `paths.{パス}.{メソッド}` を参照

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
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.{チャネル名}` を参照

## データアクセス・実行条件

- **操作定義**: [_model-summary.yaml](_model-summary.yaml) の `tables[name={name}].operations`。
  カラム型は統合 datastore schema を参照し、ここへ再掲しない。
- **業務ルール**: [spec.md](spec.md) の `{RULE-ID}` を `{処理名}` で適用する。
- **トランザクション**: {同時に確定する操作、失敗時に戻す範囲、外部副作用の実行時点}
- **競合制御**: {再判定する条件、ロック / 一意制約等、競合時の結果}
- **冪等性**: {キーのスコープ・保持期間、同一/異なる本文、処理中、失敗後の再送}
- **副作用**: {監査・イベント・キャッシュ更新の対象とタイミング}

{該当項目のみ記述。共有規約がある項目はファイル + 見出しを指定し、UC固有の値だけ補足する。
API のエラー表には条件と応答の対応を残すが、業務ルールの本文を再定義しない。}

## ティア完了条件（BDD）

```gherkin
Feature: {UC名} - {ティア名}

  Scenario: {APIシナリオ}
    Given {前提条件}
    When {APIリクエスト}
    Then {APIレスポンス}
```
````

API の型・必須・制約・正常応答・業務エラーの定義は契約生成元として維持する。
単なる参照にしない。既存契約がある場合は差異を解消し、未使用の項目・該当しない非同期節は生成しない。
