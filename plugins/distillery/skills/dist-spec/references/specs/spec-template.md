# Spec テンプレート定義

> Step3 で使用。共通の出力規約と spec.md のフォーマット。

catalog modeを明示された場合は `references/specs/contract-catalog.md` の派生物/参照規約を優先する。
APIの入出力型表とsummaryを手書きする以下の規約はlegacy modeに限る。

## 出力規約

- **一つの判断は一箇所に定義する**。業務ルールは spec.md、tier 固有の実行条件は tier md、
  データアクセスは `_model-summary.yaml`、DB の型・制約は統合 datastore schema に置く。
  複数 UC の共有規則は既存の共有定義を参照し、同じ本文を UC ごとに再定義しない。
- **API 契約は現行形式を維持する**。API tier の入出力・エラー表は summary / OpenAPI の生成元として残す。
  `_api-summary.yaml` は中間出力。完全な契約を持たない summary への参照だけに置き換えない。
- 参照は **ファイル + 見出し / ルールID / operationId / スキーマ名 / テーブル名**で対象を特定する。
  「共通仕様に従う」だけの記載は禁止。UC 内は相対リンク、artifact root 基準のパスはその旨を明記する。
  初回生成で統合先が未生成なら、定義を省かず、Step4 の統合後に参照先と内容を検証する。
- spec.md に通常のレイヤー往復図やその変換表を生成しない。順序・競合・非同期境界を説明する場合だけ
  `処理フロー` または `データフロー` を追加する。同じ情報を図と表で重ねない。
- 該当しない任意セクションは見出しごと省く。「該当なし」の表や、最低行数を満たすための説明を作らない。
  原子性、認可、冪等性、失敗時の副作用、日付境界等、結果を変える判断は省略しない。
- BDD は仕様の具体例として残す。UC は利用者から観測できる業務結果、tier は認可・競合・再送・表示など
  その境界固有の保証を検証する。同じシナリオの言い換えを増やさないが、異なる保証を削らない。
  各 UC / tier に具体値を含む Given / When / Then を置く。
- 共通ルールの参照は本文の複写を不要にするだけであり、RDRA 要素と適用箇所・BDD の対応は保持する。
  未確定の判断を推測で埋めず、確認推奨項目にする。

## ディレクトリ構成

```text
{業務名}/{BUC名}/
  buc-spec.md
  {UC名}/
    spec.md
    tier-{tier_id}.md
    _api-summary.yaml       # API / 非同期契約がある場合
    _model-summary.yaml
```

ティアは arch-design.yaml の `system_architecture.tiers` から選定する。
対象 kind の `references/specs/tier-templates/` のファイルだけを読む。

## spec.md フォーマット

````markdown
# {UC名}

## 概要

{目的・操作するアクター・範囲を1〜3文で記述}

## 業務ルール

| ID | RDRA要素（条件・バリエーション） | 判定・計算・結果、または共有定義への参照 | 適用 tier / 箇所 | BDD Scenario |
|----|-------------------------------|----------------------------------------|----------------|--------------|
| RULE-001 | {実在する条件名。関連する値も列挙} | {境界値・計算式・不成立時の結果} | {tier-id / 処理名} | {シナリオ名} |

{複数行の対応表が必要ならここだけに定義する。他のルールはそのIDを参照する。
日付計算には基準日・タイムゾーン・端点の扱いなど、入力で確定した判断を残す。}

## 状態遷移一覧

| 状態モデル | 遷移元 | 遷移先 | 条件 / 共有遷移定義 | 事後処理 / 操作定義への参照 | 適用 tier |
|-----------|--------|--------|-------------------|--------------------------|-----------|
| {モデル名} | {元} | {先} | {RULE-ID または file + 遷移ID} | {_model-summary.yaml の table / operation 等} | {tier-id} |

## 関連 RDRA モデル

| モデル種別 | 要素名 | 関連 / 適用箇所 |
|-----------|--------|----------------|
| 業務 | {業務名} | 所属 |
| BUC | {BUC名} | 所属 |
| アクター | {アクター名} | 操作 |
| 情報 | {情報名と対象属性} | {_model-summary.yaml の model / table、または契約のschema / property} |
| 条件 / バリエーション | {要素名・値} | {RULE-ID} |
| 状態 | {状態モデル名} | {状態遷移一覧の行} |
| 外部システム | {要素名} | {tier md の連携定義} |

## E2E 完了条件（BDD）

```gherkin
Feature: {UC名}

  Scenario: {正常系の業務結果}
    Given {具体的な前提}
    When {アクターの操作}
    Then {観測可能な結果}

  Scenario: {不成立時の業務結果}
    Given {具体的な不成立条件}
    When {アクターの操作}
    Then {観測可能な失敗と変更されない情報}
```

## ティア別仕様

- [{ティア名}](tier-{tier_id}.md)
- [OpenAPI](../../../_cross-cutting/api/openapi.yaml): `{operationId}`
- [AsyncAPI](../../../_cross-cutting/api/asyncapi.yaml): `{channel / operation}`（存在する場合のみ）
````

`概要`、`関連 RDRA モデル`、`E2E 完了条件`、`ティア別仕様` は必須。
`業務ルール` と `状態遷移一覧` は該当時のみ。既存 Spec の分岐条件一覧・計算ルール一覧・
バリエーション一覧も読取可能とし、新規生成時は業務ルールへまとめる。
ルール ID は文書内で一意・更新時に維持し、別 UC から参照する場合はファイルも指定する。

## ティア別フォーマット

| kind | ファイル |
|------|----------|
| presentation | `references/specs/tier-templates/presentation.md` |
| api | `references/specs/tier-templates/api.md` |
| worker | `references/specs/tier-templates/worker.md` |
| cli | `references/specs/tier-templates/cli.md` |

design 無しモードでは、画面仕様・コンポーネント設計・デザイントークン参照・screens を生成しない。
BUC のフォーマットは `references/specs/buc-spec-template.md`。
