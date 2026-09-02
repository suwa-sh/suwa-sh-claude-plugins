# Part 0: ドメインアーキテクチャ推論ルール

> **読み込みタイミング**: Step1 の Part 0（ドメイン）推論 subagent だけが読む。基本方針・入力ファイル表・Part 索引は `references/arch-inference-rules.md`。

DDD 戦略的設計の観点（Subdomain / BoundedContext / ContextMap / AggregateHypothesis）を RDRA から推論する。詳細な判定条件・confidence 上限・出力規約は `references/arch-domain-patterns.md` を参照。本セクションは Part 1〜3 で参照するためのサマリ。

### 推論順序

1. **Q1: Subdomain 分類** — BUC クラスタ + 外部システム + システム概要から Core / Supporting / Generic を仕分け
2. **Q2: BoundedContext** — 情報.tsv の同名異義語 + 状態.tsv の独立性 + BUC のアクター分布から BC を切る
3. **Q3: ContextMap** — BC 間依存方向 + 外部システム連携から統合パターン（ACL / OHS / Conformist 等）を選定
4. **Q4: AggregateHypothesis** — 情報.tsv の relationships + 状態.tsv の遷移波及から集約境界を **仮説として**提示

### confidence 上限ルール（validator で自動 WARN）

| 対象 | 上限 | 理由 |
|---|---|---|
| Core サブドメイン | `medium` | 経営判断（競争優位）は自動推論できない。ユーザー確認必須 |
| BC 分割 | `medium` | 言語境界の機械判定（同名異義語検出）は誤判定が多い |
| 集約境界仮説 | `low` | 戦略段階の仮説。最終確定は dist-spec or ddd-tactical-implementation |

### Part 1 以降への伝播

Part 0 で確定した BC を Part 1 以降が参照する:

- **ティア:BC の対応形態**（Part 1 システム）: BC 数 + NFR A/B + チーム規模から モノリス / モジュラモノリス / マイクロサービス を選定
- **認可モデル選定の重み付け**（Part 1 認可）: Core BC は厳格認可 / Generic BC は簡易認可（後述「認可モデル選定ルール」参照）
- **レイヤリング**（Part 2 アプリ）: モジュラモノリス時は BC = モジュール構造
- **データモデル / 集約境界**（Part 3 データ）: BC.owned_entity_ids[] が entity の所属 BC を確定。aggregate_hypotheses は entity の論理グルーピングのヒント

---
