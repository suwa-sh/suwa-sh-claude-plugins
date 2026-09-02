# RDRA + NFR → アーキテクチャ推論ルール

RDRA モデルと NFR グレードからアーキテクチャ設計を推論するためのルール定義。
全てのテクノロジー記述はベンダーニュートラルとし、特定クラウドベンダーのサービス名は使用しない。

## 推論の基本方針

1. RDRA モデルと NFR グレードから読み取れる情報を最大限活用し、可能な限り自動で設計判断を推定する
2. 推論には confidence（確信度）を付与し、対話ステップでの確認優先度を決定する
3. 推論不能な項目は一般的なベストプラクティスを適用し、confidence: "default" とする
4. テクノロジー候補はベンダーニュートラルな用語のみ使用する（`references/schema/common.md` のベンダーニュートラル用語ガイド参照）
5. クラウドデザインパターンの適用判断には `arch-design-patterns.md` を参照し、RDRA/NFR シグナルとパターンの対応を確認する
6. **問題空間を先に解く**: ドメインアーキテクチャ（Part 0）を技術選定（Part 1 以降）より先に推論する。サブドメイン / BC / コンテキストマップ / 集約境界仮説の確定後に、Part 1〜3 の推論で参照する

## 入力ファイル

| ファイル | 主な推論先 |
|---------|-----------|
| `docs/rdra/latest/BUC.tsv` | サブドメインクラスタリング、ティア構成、バッチ/ワーカー判定、API 粒度 |
| `docs/rdra/latest/アクター.tsv` | フロントエンドティア要否、認証方式 |
| `docs/rdra/latest/外部システム.tsv` | Generic サブドメイン候補、外部連携ティア、コンテキストマップ統合パターン |
| `docs/rdra/latest/情報.tsv` | 同名異義語検出、BC 所有 entity、概念データモデル、エンティティ、リレーション、集約候補 |
| `docs/rdra/latest/状態.tsv` | BC 独立性、集約境界仮説、状態管理戦略、ドメインイベント |
| `docs/rdra/latest/条件.tsv` | invariants 抽出、ビジネスルール層の複雑さ、バリデーション方針 |
| `docs/rdra/latest/バリエーション.tsv` | ストラテジーパターンの要否 |
| `docs/rdra/latest/システム概要.json` | Core サブドメイン判定、システム全体像、対象ユーザー |
| `docs/nfr/latest/nfr-grade.yaml` | 冗長構成、性能戦略、セキュリティ、運用方針 |

参照ドキュメント:

| ファイル | 役割 |
|---------|------|
| `references/arch-domain-patterns.md` | Part 0 の RDRA → DDD 結線ルール詳細 + ddd-architecture スキルへの参照リンク |

---

---

## Part 別ルール（分割ファイル）

推論ルール本体は Part ごとに分割されている。**各 Part の推論 subagent は自分の Part のファイルだけを読む**
（Step1 の Part 別 subagent 化。メインエージェントは本ファイル（索引）と `_draft/*.md` の要約だけを読む）。

### Part 別入力表（正本。指示ファイル `references/arch/stage-instructions/step1-part0.md` / `step1-part123.md` はこの表に従う）

| Part | ファイル | RDRA | NFR カテゴリ | 前 Part の要約 | 参照するパターン集（該当シグナル時のみ、名前引きで該当 `###` 節だけ） |
|------|---------|------|-------------|---------------|----------------------------------------------------------------|
| Part 0 ドメイン | `references/inference/part0-domain.md` | 全 tsv + システム概要.json | なし（RDRA のみ） | — | `references/arch-domain-patterns.md`（全体） |
| Part 1 システム | `references/inference/part1-system.md` | 全 tsv + システム概要.json | A〜F 全部（NFR 全体の影響分析も担う） | `_draft/00-domain.md` | `references/arch-design-patterns.md` / `arch-logging-patterns.md` |
| Part 2 アプリケーション | `references/inference/part2-app.md` | 全 tsv + システム概要.json | A・B・C・E | `_draft/00-domain.md` + `_draft/01-system.md` | `references/arch-app-patterns.md` / `arch-logging-patterns.md` / `arch-design-patterns.md`（CQRS 節） |
| Part 3 データ | `references/inference/part3-data.md` | 全 tsv + システム概要.json | A・B・D・E | `_draft/00-domain.md` | `references/arch-data-patterns.md` / `arch-design-patterns.md`（データ管理・回復性の節） |
| 出力形式 | `references/inference/output-format.md` | — | — | — | Step3 の `_inference.md` 生成で使う |

RDRA tsv は合計数十 KB と小さいので全 Part が全部読む（Part ごとに絞る運用は入力漏れの原因になるためやめた）。

実行順は **Part 0 → Part 1 → (Part 2 ∥ Part 3)**。Part 1〜3 は Part 0 の結果（`_draft/00-domain.md` の BC / owned_entity_ids /
認可重み付け）を、Part 2 はさらに Part 1 の結果（確定ティア id）を前提にする。

## 共通ルール: Entity ID の決定規則（Part 0 と Part 3 で共有）

`data_architecture.entities[].id` と `domain_architecture` の `owned_entity_ids[]` / 集約 root は **同じ ID** を指す必要がある
（validator がクロスリファレンス不整合を ERROR にする）。Part 0 と Part 3 は別 subagent なので、次の決定的規則で採番する:

- **初期構築**: `docs/rdra/latest/情報.tsv` のデータ行（ヘッダ除く）を上から 1 始まりで数え、`E-{NNN}`（3 桁ゼロ埋め）とする。
  セッション・キャッシュ等の派生エンティティ（Part 3 が追加するもの）は `E-9{NN}`（`E-901` から）とし、Part 0 は参照しない
- **差分更新**: 既存 `latest/arch-design.yaml`（または `_digest/data_architecture.yaml`）の `entities[].id` を優先し、
  新規の情報行にだけ末尾の続き番号を振る（既存 ID を振り直さない）
- 両 Part は要約 md に「Entity id ↔ 情報.tsv の名前」の対応表を載せ、Step3 で突合する
