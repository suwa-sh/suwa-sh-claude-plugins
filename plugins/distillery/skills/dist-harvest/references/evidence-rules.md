# evidence / confidence マーキング規則

逆生成では「コードから読み取った事実」と「LLM の推測」が必ず混在する。両者を成果物上で区別し、
後段スキル（quality-attributes 以降）やユーザーが「どこまで信頼できるか」を判断できるようにする。
本規則は全 Phase・USDM 逆生成の両方で必須とする。

## 基本原則

**全てのインベントリ項目に根拠（evidence）を必ず付ける。** 根拠なしの項目を成果物に残してはならない。

根拠は次の 2 種類のいずれかで記載する:

- **事実**: `事実: {ファイルパス:行}` — コード・定義・ドキュメントから直接読み取れたもの
- **推測**: `推測: {根拠となった手がかり}` — 直接読めず、状況証拠や一般論から補完したもの

## confidence レベル

| レベル | 意味 | 判定基準 |
|--------|------|----------|
| `high` | 実装された事実 | データストア定義・エンドポイント定義・ドメインコードから直接読める |
| `medium` | 状況証拠あり | テスト・設定・UI・命名規則など間接的な証拠から導ける |
| `low` | 推測 | コード/ドキュメント/コミット履歴のいずれからも読めず、ドメイン一般論で補完した |

- 「なぜ（reason / 要求の理由）」は実装コードには通常書かれない。ドキュメント・コミット履歴・PR から
  読めた場合は `high`/`medium`、読めなかった場合は推測として必ず `low` を付ける。
- 迷った場合は**低い方**に倒す（過信を避ける）。

## analysis ドキュメントでの記法

各インベントリ表に `根拠` 列と `確度` 列を設ける。例（アクター）:

```markdown
| アクター | 説明 | 確度 | 根拠 |
|----------|------|------|------|
| 会員 | 図書館サービスの利用者 | high | 事実: backend/models/member.rb:1, config/roles.yml:3 |
| 司書 | 蔵書の発注・登録を行う職員 | medium | 推測: 管理画面ルーティング admin/books に専用権限。ロール名は未定義 |
```

自由記述セクション（詳細説明等）で個別に根拠を添える場合は、文末に `（事実: path:line）` /
`（推測: 手がかり）` を括弧書きで付す。

## USDM YAML での拡張フィールド

USDM 逆生成では、各 requirement / specification に以下の拡張フィールドを付与する。
バリデータ（`validateRequirements.js`）は `additionalProperties` 制約を持たないため、
これらの追加フィールドを付けても構造検証は PASS する（確認済み）。

```yaml
requirements:
  - id: "REQ-001"
    requirement: "..."
    reason: "..."
    priority: "must"
    confidence: "high"          # high | medium | low
    evidence:                   # 配列。各要素は path（必須）と note
      - path: "backend/models/loan.rb:12"
        note: "貸出情報エンティティと返却予定日カラム"
    specifications:
      - id: "SPEC-001-01"
        specification: "..."
        confidence: "medium"
        evidence:
          - path: "spec/features/loan_spec.rb:20"
            note: "貸出上限のテストケースから受け入れ基準を抽出"
        acceptance_criteria:
          - "..."
        affected_models:
          - type: "information"
            action: "add"
            target: "貸出情報"
```

- `evidence` の各要素は `path`（文字列、必須）と `note`（文字列、任意）を持つ。
  推測項目で参照ファイルが無い場合は `path: "推測"` とし、`note` に手がかりを書く。
- `confidence` は requirement と specification の両方に付ける。

## Phase3 ユーザー確認での扱い

`confidence: low` の項目は、後段に「推測が事実として流れる」リスクが最も高い。Phase3 のユーザー確認では
`confidence: low` の項目を必ず一覧で提示し、対話フォーマット（3案 + ⭐推奨 + 一行説明 + 推奨理由）で
確認を求める。推奨理由の confidence 表記に本ファイルのレベルをそのまま使う。

## FIXME / TODO の記録

解析中に矛盾・不整合（参照先が未定義、定義したが未参照 等）を見つけた場合は、対象 analysis
ドキュメントに `FIXME: {矛盾内容}` として記録し、放置しない。RDRA フルビルド前に解消するか、
解消できない場合は Phase3 の確認対象に含める。
