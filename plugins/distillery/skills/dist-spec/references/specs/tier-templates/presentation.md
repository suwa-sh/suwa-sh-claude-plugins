# tier-{tier_id}.md フォーマット（Presentation 系ティア）

> **読み込みタイミング**: Step3 の UC Spec 生成 subagent が、対象ティアの kind に一致するファイル**だけ**を読む
> （kind はオーケストレータが Step1 で確定し、subagent 指示の「対象ティア」に `(kind)` として渡す）。
> 共通部（spec.md フォーマット・注意事項）は `references/specs/spec-template.md`。

Presentation 系ティア（SPA, SSR, モバイルアプリなど UI を持つティア）の場合に使用する。
該当判定: `tiers[].technology_candidates` に SPA, SSR, MPA, モバイルアプリ等の UI 技術が含まれる場合。

```markdown
# {UC名} - {ティア名}仕様

## 変更概要

{このティアで必要な変更の概要}

## 画面仕様

<!-- 「画面仕様」「コンポーネント設計」の 2 節は design-event.yaml が存在する（design_available: true）場合のみ生成する。
     design 無しモードでは省略し、UI ロジック・操作フロー・ティア完了条件のみ記述する -->

### {画面名}

- **URL**: {画面のパス}
- **アクセス権**: {アクセスできるアクター}
- **ポータル**: {該当ポータル（design-event.yaml の portal.id）}

#### 表示要素とコンポーネントマッピング

| 要素 | 種別 | デザインシステムコンポーネント | 説明 |
|------|------|------------------------------|------|
| {要素名} | テキスト/ボタン/テーブル/フォーム | {design-event.yaml のコンポーネント名} | {説明} |

#### デザイントークン参照

| 用途 | トークン | 値 |
|------|---------|---|
| 背景色 | var(--semantic-background) | {design-event.yaml の値} |
| アクセント | var(--portal-primary) | {ポータルのprimary_color} |

#### UIロジック

- **状態管理**: {画面内の状態管理方針}
- **バリデーション**: {フロントエンドバリデーションルール}
- **ローディング**: {データ取得時のローディング表示方針}
- **エラーハンドリング**: {UIレベルのエラー処理}

#### 操作フロー

1. {操作ステップ1}
2. {操作ステップ2}
3. ...

## コンポーネント設計

### {コンポーネント名}

- **ベースコンポーネント**: {design-event.yaml の UI/Domain コンポーネント名}
- **Props**:
  | Prop | 型 | 必須 | 説明 |
  |------|---|------|------|
  | {prop名} | string/number/boolean | Yes/No | {説明} |
- **状態**: {コンポーネントの内部状態}
- **イベント**: {発火するイベント（onClick, onChange等）}

## ティア完了条件（BDD）

```gherkin
Feature: {UC名} - {ティア名}

  Scenario: {画面表示シナリオ}
    Given {前提条件}
    When {画面操作}
    Then {画面の期待状態}
```
```
