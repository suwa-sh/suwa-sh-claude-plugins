# DDD 戦略的設計の推論パターン（distillery 独自フォーク）

dist-architecture が `domain_architecture` セクション（Subdomain / BoundedContext / ContextMap / AggregateHypothesis）を生成するための推論ルール集。

## 位置付け・スコープ宣言

- 本ドキュメントは **distillery プラグイン独自の解釈**。原典は `plugins/ddd/skills/ddd-architecture/` で別管理されており、本プラグインはそこからフォークして RDRA との結線ルールを加えた形になっている。
- DDD 完全準拠は主張しない。RDRA から導出可能な **戦略設計の仮説生成** に留め、最終判断は Phase 0 の対話でユーザー確認を必須とする。
- 詳細な原典は `plugins/ddd/skills/ddd-architecture/README.md` を参照（任意）。同マーケットプレイス内に同居している前提で相対参照する。
- 同期方針: distillery 独自フォーク。ddd プラグイン側の更新は **四半期レビュー** で取り込み判断する（バージョンピンはしない）。

## 推論方針の原則

1. **問題空間優先**: domain_architecture を技術選定（technology_context / system_architecture）より先に推論する。Phase 0（対話）はテクノロジー前。
2. **仮説生成、判断委譲**: ルールベースで仮説を提示し、Core 判定 / BC 分割 / 集約境界の確定は必ずユーザー対話で確認する。
3. **confidence 上限ルール**:
   - Core サブドメイン → 自動推論では `confidence: medium` 以下
   - BC 分割 → `confidence: medium` 以下
   - 集約境界仮説 → `confidence: low`（戦略段階の仮説）
4. **片側参照**: BC.owned_entity_ids[] が Entity-BC 関係の唯一の正規参照。Entity 側に bounded_context_id は持たない。

## Q1: サブドメイン分類

Core / Supporting / Generic を仕分け、投資配分を決める。

### 判定ルール

| 判定条件 | 推論 | confidence |
|---|---|---|
| システム概要.json に「競争優位」「差別化」「独自」「コア」キーワード明示 + BUC クラスタが該当業務を含む | Core | **medium** |
| BUC が中核業務を支援するが差別化要因ではない（管理・登録・通知系） | Supporting | medium |
| 外部システム.tsv の機能カテゴリと一致する BUC（決済 / 認証 / 帳票 / メール / 監視） | Generic | high |
| 上記いずれも判定不能 | Supporting（保守側に倒す） | default |

### BUC クラスタリング規則

同一 UC グループ + 同じ主アクターを共有する BUC を 1 サブドメイン候補とする。

### 投資方針の定型文

| type | investment_policy 既定文 |
|---|---|
| core | 「最優先で深いモデリングと継続的リファクタリングに投資。チーム最強の人材を配置」 |
| supporting | 「good enough な品質で安定運用。標準的なフレームワーク採用」 |
| generic | 「外部 SaaS / ライブラリ採用、自作回避。コスト効率優先」 |

### 注: Core 候補は全件「ユーザー確認必須」

RDRA に経営判断の根拠は無い。Phase 0.1 の対話で必ず「これは本当に競争優位か」を確認する。

## Q2: 境界づけられたコンテキスト

ユビキタス言語 / チーム / 状態モデルの境界で BC を分割する。

### 判定ルール

| 判定条件 | 推論 | confidence |
|---|---|---|
| 情報.tsv で同名異義語検出（同じ用語が異なる属性集合を持って複数登場） | BC 分割の **仮説提示** | **medium** |
| 状態.tsv の状態モデルが完全独立（共通状態を共有しない） | BC 分割 | medium |
| BUC クラスタが別アクター集合 | BC 分割 | medium |
| 外部システム連携領域 | 外部システムごとに独立 BC（Generic 寄り） | medium |
| 1 サブドメイン内で BUC が密結合 | 1 SD = 1 BC | medium |
| 判定不能（小規模、BUC <= 3 かつ外部システム = 0） | 1 BC | default |

### ユビキタス言語の核語彙抽出

各 BC は最低 1 件の `ubiquitous_language` エントリを持つ。抽出元:

1. 情報.tsv のエンティティ名（その BC で扱う主要概念）
2. 状態.tsv の状態名（その BC で意味を持つ状態）
3. BUC.tsv のアクティビティ動詞（その BC でのアクション）

同名異義語が検出された場合は、各 BC でその語の定義を **明示的に書き分ける**こと（"会議室" vs "課金対象施設" のように）。

### チーム所有 (team_ownership)

RDRA からは推論できない。自動推論では `null` 固定。Phase 0.2 の対話で「Conway の法則的にチーム所有者は誰か」を確認する。チーム情報が確定しなくても `null` のままで設計を進められる。

### 注: BC 分割は全件「ユーザー確認必須」

機械的な同名異義語検出は誤判定が多い（用語が重複していても文脈で意味が違うとは限らない）。`confidence: medium` 上限で仮説提示に留め、Phase 0.2 で対話確認。

## Q3: コンテキストマップ

BC 間の統合パターン（依存方向 + 翻訳責務）を決める。

### 依存方向の判定

BUC.tsv の UC 内で参照される側を「上流」、参照する側を「下流」と判定する。例:
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

### 統合イベント (integration_events)

戦略段階では空配列 `[]` で良い。具体的なイベント名（"ReservationConfirmed" 等）は後続の dist-spec が UC 解析時に確定する。

## Q4: 集約境界仮説

BC 内の強整合境界（集約 = aggregate）を **仮説として** 提示する。最終確定は別スキル（dist-spec or ddd-tactical-implementation）。

### 判定ルール（全件 confidence: low）

| 判定条件 | 推論 | confidence |
|---|---|---|
| 情報.tsv の relationships で「所有」「包含」「明細」 | 親 = root 仮説、子 = member | **low** |
| 状態.tsv の状態遷移が複数 entity に同期波及 | 集約境界仮説 | low |
| event_snapshot 型 | aggregate root の有力候補 | low |
| 1 エンティティが独立した状態を持つ | 単独 aggregate | low |

### invariants の抽出

条件.tsv のビジネスルールから、以下のキーワードを含むものを invariants に変換:
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

判定材料: NFR A（可用性）/ B（性能スケール）/ BUC 数 / チーム規模。Phase 1（システム）の冒頭で確認する。

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
