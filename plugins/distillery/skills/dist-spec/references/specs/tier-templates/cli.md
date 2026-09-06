# tier-{tier_id}.md フォーマット（CLI 系ティア。id に cli / command / tui を含む）

`product-spec-writing.md`を適用する。生成本文は実装対象の振る舞いを表、リスト、図で記述し、生成状態は本文外へ記録する。還流後は具体案と最新正本が一致すれば本文を維持して整合確認を記録する。


> **読み込みタイミング**: Step3 の UC Spec 生成 subagent が、対象ティアの kind に一致するファイル**だけ**を読む
> （kind はオーケストレータが Step1 で確定し、subagent 指示の「対象ティア」に `(kind)` として渡す）。
> 共通部（spec.md フォーマット・注意事項）は `references/specs/spec-template.md`。

```markdown
# {UC名} - {ティア名}仕様

## 変更概要

{このティアで必要な変更の概要}

## コマンド契約

### {コマンド名}

- **書式**: `{cli} {sub-command} [options] <args>`
- **アクセス権**: {実行できるアクター / 認証方式}

#### 引数・オプション

| 名前 | 型 | 必須 | 既定値 | 説明 |
|------|---|------|-------|------|
| {--option} | string/number/boolean/enum | Yes/No | {既定値} | {説明} |

- **stdin**: {受け付ける入力（無ければ「なし」）}

## 出力契約

- **stdout**: {出力する情報。フォーマットは `_cross-cutting/ux-ui/ui-design.md` の出力規約に従う（table / json / plain）}
- **stderr**: {エラー・警告メッセージの内容}
- **終了コード**:
  | コード | 意味 | 条件 |
  |-------|------|------|
  | 0 | 成功 | {条件} |
  | {n} | {入力エラー / 業務エラー / システムエラー} | {条件} |

## UC ロジック

- **バリデーション**: {引数・オプションの検証ルール}
- **確認プロンプト**: {破壊的操作の確認有無、`--yes` の扱い}
- **冪等性**: {再実行時の振る舞い}
- **エラーハンドリング**: {stderr 出力と終了コードの対応}

## ティア完了条件（BDD）

```gherkin
Feature: {UC名} - {ティア名}

  Scenario: {コマンド実行シナリオ}
    Given {前提条件（引数・環境）}
    When `{cli} {sub-command} ...` を実行する
    Then 終了コード {n} で stdout に {期待出力} が出る
```
```
- tier-{tier_id}.md（API系）の API 仕様は `_cross-cutting/api/openapi/openapi.yaml` と整合させる
- `app_architecture.tier_layers[].layers` からティアごとのレイヤー構成を参照し、仕様に反映する
