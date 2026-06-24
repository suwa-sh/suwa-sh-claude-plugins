# RDRA → DDD 戦略設計の結線ルール

dist-architecture が `domain_architecture` セクション（Subdomain / BoundedContext / ContextMap / AggregateHypothesis）を生成するための **RDRA との結線ルール集**。

## 位置付け・スコープ宣言

- 本ドキュメントは **distillery 独自の RDRA → DDD アダプタ**。DDD の概念解説・パターン定義は本ドキュメントに含めない。
- DDD 概念の **正典は `ddd-architecture` スキル**（`ddd:ddd-architecture`）。本スキルは `ddd-architecture` の存在を前提とし（`SKILL.md` 冒頭の依存チェック参照）、概念定義はそちらに委譲する。
- DDD 完全準拠は主張しない。RDRA から導出可能な戦略設計の **仮説生成** に留め、最終判断は Phase 0 の対話でユーザー確認を必須とする。

## DDD 概念リファレンス（ddd-architecture スキル）

各概念の詳細・判断基準・パターン解説は ddd-architecture スキルの references を参照すること（インストール後にアクセス可能）。

| ddd-architecture の references | 扱う概念 | 本スキルでの呼び出し場面 |
|---|---|---|
| `subdomain.md` | Core / Supporting / Generic の分類基準、投資配分の考え方 | Q1: Subdomain 分類 |
| `bounded-context.md` | 言語境界 / Conway の法則 / ユビキタス言語 | Q2: BC 分割 |
| `context-map.md` | Shared Kernel / Customer-Supplier / Conformist / ACL / OHS / Published Language の各パターン | Q3: コンテキストマップ |
| `strategy-to-tactics.md` | BC → 集約 → 値オブジェクトの連鎖、モジュラモノリス → 分割戦略 | Q4: Aggregate 仮説 |

ddd-architecture スキルが未インストールの場合は本スキルの SKILL.md の「依存スキル」セクションを参照してインストールすること。本ファイルの推論ルールだけでも仮説生成は可能だが、判断の妥当性検証には ddd-architecture の references を参照することを強く推奨する。

## 推論方針の原則

1. **問題空間優先**: domain_architecture を技術選定（technology_context / system_architecture）より先に推論する（Phase 0 はテクノロジー前）。
2. **仮説生成、判断委譲**: ルールベースで仮説を提示し、Core 判定 / BC 分割 / 集約境界の確定は必ずユーザー対話で確認する。
3. **confidence 上限ルール**:
   - Core サブドメイン → 自動推論では `confidence: medium` 以下（経営判断のため）
   - BC 分割 → `confidence: medium` 以下（言語境界は機械判定が粗いため）
   - 集約境界仮説 → `confidence: low`（戦略段階の仮説）
4. **片側参照**: BC.owned_entity_ids[] が Entity-BC 関係の唯一の正規参照。Entity 側に bounded_context_id は持たない。

## Q1: サブドメイン分類（RDRA 結線ルール）

### 判定の入力

- `BUC.tsv` のクラスタリング
- `外部システム.tsv` の機能カテゴリ
- `システム概要.json` のキーワード

### 判定ルール

| 判定条件 | 推論 | confidence |
|---|---|---|
| システム概要.json に「競争優位」「差別化」「独自」「コア」キーワード明示 + BUC クラスタが該当業務を含む | Core | **medium**（要ユーザー確認） |
| BUC が中核業務を支援するが差別化要因ではない（管理・登録・通知系） | Supporting | medium |
| 外部システム.tsv の機能カテゴリと一致する BUC（決済 / 認証 / 帳票 / メール / 監視） | Generic | high |
| 上記いずれも判定不能 | Supporting（保守側に倒す） | default |

Core/Supporting/Generic の **意味と投資配分の考え方** は ddd-architecture の `references/subdomain.md` を参照。

### BUC クラスタリング規則

同一 UC グループ + 同じ主アクターを共有する BUC を 1 サブドメイン候補とする。

### investment_policy の出力定型文

`Subdomain.investment_policy` フィールドへの出力に使う定型文（出力スキーマ要件のため本ドキュメントで保持）:

| type | investment_policy 既定文 |
|---|---|
| core | 「最優先で深いモデリングと継続的リファクタリングに投資。チーム最強の人材を配置」 |
| supporting | 「good enough な品質で安定運用。標準的なフレームワーク採用」 |
| generic | 「外部 SaaS / ライブラリ採用、自作回避。コスト効率優先」 |

### 注: Core 候補は全件「ユーザー確認必須」

RDRA に経営判断の根拠は無い。Phase 0.1 の対話で必ず「これは本当に競争優位か」を確認する。

## Q2: 境界づけられたコンテキスト（RDRA 結線ルール）

### 判定の入力

- `情報.tsv` のエンティティ名・属性（同名異義語検出）
- `状態.tsv` の状態モデルの独立性
- `BUC.tsv` の主アクター分布
- `外部システム.tsv` の連携領域

### 判定ルール

| 判定条件 | 推論 | confidence |
|---|---|---|
| 情報.tsv で同名異義語検出（同じ用語が異なる属性集合を持って複数登場） | BC 分割の **仮説提示** | **medium** |
| 状態.tsv の状態モデルが完全独立（共通状態を共有しない） | BC 分割 | medium |
| BUC クラスタが別アクター集合 | BC 分割 | medium |
| 外部システム連携領域 | 外部システムごとに独立 BC（Generic 寄り） | medium |
| 1 サブドメイン内で BUC が密結合 | 1 SD = 1 BC | medium |
| 判定不能（小規模、BUC <= 3 かつ外部システム = 0） | 1 BC | default |

BC の概念定義（言語境界 / チーム境界 / ユビキタス言語）は ddd-architecture の `references/bounded-context.md` を参照。

### ユビキタス言語の核語彙抽出

各 BC は最低 1 件の `ubiquitous_language` エントリを持つ。RDRA からの抽出元:

1. `情報.tsv` のエンティティ名（その BC で扱う主要概念）
2. `状態.tsv` の状態名（その BC で意味を持つ状態）
3. `BUC.tsv` のアクティビティ動詞（その BC でのアクション）

同名異義語が検出された場合は、各 BC でその語の定義を **明示的に書き分ける**こと（"会議室" vs "課金対象施設" のように）。

### チーム所有 (team_ownership)

RDRA からは推論できない。自動推論では `null` 固定。Phase 0.2 の対話で「Conway の法則的にチーム所有者は誰か」を確認する（Conway の法則の意味は ddd-architecture の `references/bounded-context.md` 参照）。チーム情報が確定しなくても `null` のままで設計を進められる。

### 注: BC 分割は全件「ユーザー確認必須」

機械的な同名異義語検出は誤判定が多い（用語が重複していても文脈で意味が違うとは限らない）。`confidence: medium` 上限で仮説提示に留め、Phase 0.2 で対話確認。

## Q3: コンテキストマップ（RDRA 結線ルール）

### 判定の入力

- BUC.tsv の UC 内での参照関係（依存方向の判定）
- 外部システム.tsv（外部連携の有無）
- BC の owned_buc_ids の依存関係

### 依存方向の判定

`BUC.tsv` の UC 内で参照される側を「上流」、参照する側を「下流」と判定する。例:
- 予約 UC が請求 BC を呼び出す → 予約 BC = downstream, 請求 BC = upstream

### パターン選定ルール

| 判定条件 | パターン | confidence |
|---|---|---|
| 外部システム連携 | Conformist or ACL | high |
| 外部 API がドメインと乖離（汚いモデル） | ACL | high |
| 自前 BC 同士 + 下流が複数 | 上流に OHS + Published Language | medium |
| 自前 BC 同士で対等な相互参照 | Customer-Supplier | medium |
| 共有エンティティが避けられない（極小領域） | Shared Kernel | **low**（避けるべきだが認める） |
| 影響力ゼロ + 受容可 | Conformist | medium |

各統合パターン（Shared Kernel / Customer-Supplier / Conformist / ACL / OHS / Published Language）の **意味とトレードオフ** は ddd-architecture の `references/context-map.md` を参照。

### 統合イベント (integration_events)

戦略段階では空配列 `[]` で良い。具体的なイベント名（"ReservationConfirmed" 等）は後続の dist-spec が UC 解析時に確定する。

## Q4: 集約境界仮説（RDRA 結線ルール）

### 判定の入力

- `情報.tsv` の relationships（所有 / 包含 / 明細）
- `状態.tsv` の状態遷移の同期波及範囲
- `data_architecture.entities[].model_type`（event_snapshot を優先）

### 判定ルール（全件 confidence: low）

| 判定条件 | 推論 | confidence |
|---|---|---|
| 情報.tsv の relationships で「所有」「包含」「明細」 | 親 = root 仮説、子 = member | **low** |
| 状態.tsv の状態遷移が複数 entity に同期波及 | 集約境界仮説 | low |
| event_snapshot 型 | aggregate root の有力候補 | low |
| 1 エンティティが独立した状態を持つ | 単独 aggregate | low |

集約の概念定義と戦術設計への落とし込みは ddd-architecture の `references/strategy-to-tactics.md` を参照。

### invariants の抽出

`条件.tsv` のビジネスルールから、以下のキーワードを含むものを invariants に変換:
- 「〜できない」（禁止条件）
- 「〜必須」「〜必要」（必須条件）
- 「〜重複禁止」（一意性制約）
- 「〜上限」「〜以内」（範囲制約）

機械抽出は粗いので、Phase 0.4 で対話確認する。`invariants: []` でも valid。

### 注記

`aggregate_hypotheses[].note` には必ず「仮説。最終確定は dist-spec or ddd-tactical-implementation で行う」旨を書く。

## 既存セクションとの結線

### system_architecture との関係（ガイダンスのみ、強制スキーマ化なし）

BC 数とデプロイ形態の対応:

| デプロイ形態 | tier : BC |
|---|---|
| モノリス | 1 backend-api tier : N BC |
| モジュラモノリス | 1 tier 内 = N モジュール = N BC |
| マイクロサービス | 1 tier(独立サービス) : 1 BC |

判定材料: NFR A（可用性）/ B（性能スケール）/ BUC 数 / チーム規模。Phase 1（システム）の冒頭で確認する。配置形態の選定指針は ddd-architecture の `references/strategy-to-tactics.md` を参照。

### 認可モデル選定との関係

既存の Part 1「認可モデル選定ルール」に DDD ヒントを追加（PR2 で arch-inference-rules.md を更新）:

- **Core BC**: 厳格な認可（ABAC + Domain 状態ベース）を推奨
- **Supporting BC**: RBAC + 所有権ベース
- **Generic BC**: API Gateway での RBAC のみ（簡易認可）

### data_architecture との結線

- Entity スキーマは変更しない（双方向参照を避けて整合性破綻リスクを下げる）
- BC.owned_entity_ids[] が唯一の正規参照
- 逆ビュー（entity ごとの所属 BC）が必要なら `generateArchDesignMd.js` で導出する

## スキップルール

`arch-dialogue.md` Phase 0 でのスキップ判定:

- BUC <= 3 かつ外部システム = 0 → 0.1（Subdomain）と 0.2（BC）を結合した 1 ステップに短縮
- 0.4（Aggregate）は全 entity の confidence が `default` のみなら skip 可

## 出力時の注意

- 各要素の `source_model` には根拠となった RDRA 要素を `"BUC: 会議室利用業務, 情報: 予約情報"` のような形式で記録する
- 推論元が完全に無い場合は `"なし"`（null は使わない）
- 全 confidence は `arch-schema.md` で定義された 5 値（high / medium / low / default / user）のいずれか
