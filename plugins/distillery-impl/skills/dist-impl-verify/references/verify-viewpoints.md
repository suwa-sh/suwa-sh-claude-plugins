# Verifier 7 観点チェックリスト(distillery-impl)

観点キーは findings の `viewpoint` に使う。各観点で「何と突き合わせるか」を固定する。

## 1. spec_conformance(仕様整合)— 最重要・手順まで固定

1. **API**: tier md の API 仕様表(メソッド/パス/リクエスト/レスポンス/エラー)と実装ハンドラを 1 行ずつ突合。
   `_api-summary.yaml` の endpoints[] と実装ルーティングの過不足を列挙
2. **データ**: tier md のデータモデル変更表・`_model-summary.yaml` の `tables[].operations[]` と、
   実装のスキーマ・クエリを突合(カラム欠落・型不一致・未実装の operation)。
   schema の正は `_cross-cutting/datastore/rdb-schema.yaml`(+ kvs)
3. **ビジネスルール**: tier md のビジネスルール欄の各項が、コード上のどこで担保されるかを特定。
   担保箇所を特定できないルールは blocker 候補
4. **テストとの整合**: tier BDD feature のシナリオが仕様の gherkin と一致しているか(意訳・改変されていないか)。
   スキップ・空実装の step が無いか
5. **契約**: packages/contracts の型を経由しているか(直書きの型・fetch がないか)

## 2. readability_maintainability(可読性・保守性)

- 実装リポの docs/dev-rules/coding-rules.md・test-strategy.md への準拠(テスト命名 / AAA / 用語の一致)
- 仕様の用語(RDRA 由来の名前)と実装の命名のずれ / 説明なしの複雑さ / 重複ロジック

## 3. security(セキュリティ)

- 入力検証: 契約(openapi)の制約(required / format / range)が実装でも検証されるか
- 認証・認可: tier md の認証欄・アクセス権欄との一致
- 秘密情報のハードコード / ログへの個人情報・秘密の出力

## 4. performance(パフォーマンス)

- `_model-summary.yaml` の `tables[].indexes_needed[]` に対応するインデックス・クエリ設計
- N+1 / 全件走査 / 不要な同期待ち。NFR(nfr-grade.yaml)に性能グレードがあればその水準で判定

## 5. operability(運用性)

- 失敗時に原因が特定できるログ・エラーメッセージ(利用者が直せる言葉か)
- 設定の外出し(環境依存値のハードコード禁止)

## 6. fault_tolerance(耐障害性)

- 外部呼び出し(DB / API / イベント)の失敗時挙動が仕様のエラー表と一致するか
- worker 系: 再配送への冪等性(tier-rules.md)/ 部分失敗時の整合性

## 7. refactoring(リファクタリング)

- ddd 基準(集約境界 / 値オブジェクト / 貧血回避)からの逸脱で、次の変更を高くつかせるもの
- テスト構造の負債(1 テスト複数 Act / 過剰モック / 実装詳細への結合)

## severity の目安

- **blocker**: 仕様違反・ゲート不成立・立証済みの脆弱性(修正なしで S6 へ進めない)
- **major**: 仕様は満たすが、運用・保守で高くつく欠陥(次 attempt で修正推奨)
- **minor**: 改善提案(修正は任意。learnings 行き)
