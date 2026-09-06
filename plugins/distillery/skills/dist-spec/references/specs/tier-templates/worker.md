# tier-{tier_id}.md フォーマット（非同期処理 / ワーカー系ティア）

> 新規生成は `references/specs/latest-linked-spec.md` を優先する。業務条件・状態遷移はRDRA latest、部品契約はdesign latestのStorybookへ参照し、再定義しない。分割OpenAPIを直接編集し、不足はpipelineへ還流する。

> **読み込みタイミング**: Step3 の UC Spec 生成 subagent が、対象ティアの kind に一致するファイル**だけ**を読む
> （kind はオーケストレータが Step1 で確定し、subagent 指示の「対象ティア」に `(kind)` として渡す）。
> 共通部（spec.md フォーマット・注意事項）は `references/specs/spec-template.md`。

非同期処理系ティア（メッセージコンシューマ、バッチ処理、ワーカーなど）の場合に使用する。
該当判定: `tiers[].technology_candidates` に Worker, Consumer, Batch, FaaS 等の非同期処理技術が含まれる場合。

````markdown
# {UC名} - {ティア名}仕様

## 変更概要

{このティアで必要な変更の概要}

## イベント処理仕様

### {イベントハンドラ名}

- **トリガー**: {トリガーイベント/スケジュール}
- **入力チャネル**: {サブスクライブするキュー/トピック}
- **出力チャネル**: {パブリッシュするキュー/トピック}（該当する場合）
- **AsyncAPI**: [asyncapi.yaml](../../../_cross-cutting/api/asyncapi.yaml) の `channels.{チャネル名}` を参照

#### 処理フロー

1. {処理ステップ1}
2. {処理ステップ2}
3. ...

#### エラーハンドリング

| エラー種別 | リトライ | DLQ | 説明 |
|-----------|---------|-----|------|
| {エラー種別} | Yes/No | Yes/No | {エラー処理方針} |

## データアクセス・実行条件

- **操作定義**: [_model-summary.yaml](_model-summary.yaml) の `{table / operation}`。
- **業務ルール**: [spec.md](spec.md) の `{RULE-ID}` を適用する。
- **原子性**: {更新単位、部分失敗時のロールバック / 再開点}
- **配送・再送**: {重複排除キーと保持期間、順序逆転、ack の時点、リトライ回数・間隔、DLQからの再実行}
- **副作用**: {通知・外部送信・監査の実行時点、二重実行を防ぐ条件}

{共有方針はファイル + 見出しで参照し、UC 固有の値だけ記述。データ型表や業務ルール本文は再掲しない。}

## ティア完了条件（BDD）

```gherkin
Feature: {UC名} - {ティア名}

  Scenario: {イベント処理シナリオ}
    Given {前提条件}
    When {イベント受信}
    Then {処理結果}
```
````
