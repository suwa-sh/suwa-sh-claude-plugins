# 推論結果の出力形式（_inference.md）

> **読み込みタイミング**: Step3 で `_inference.md` を生成するときに読む（arch-output.md から参照）。基本方針・入力ファイル表・Part 索引は `references/arch-inference-rules.md`。

推論結果は `_inference.md` に以下の形式でまとめる:

```markdown
# アーキテクチャ推論根拠サマリ

- event_id: {event_id}
- created_at: {created_at}

## RDRA/NFR モデル分析結果

### 分析した RDRA 要素

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | {N} | {特徴} |
| アクター | {N} | {特徴} |
| 外部システム | {N} | {特徴} |
| 情報 | {N} | {特徴} |
| 状態 | {N} | {特徴} |
| 条件 | {N} | {特徴} |
| バリエーション | {N} | {特徴} |

（Part 0 の `_draft/00-domain.md`「RDRA モデル分析結果」から転記。差分更新で Part 0 未実行なら直前イベントの値に「（前回値）」を付ける）

### 参照した NFR グレード

| カテゴリ | 平均Lv | 主な影響 |
|---------|--------|---------|
| A. 可用性 | {N} | {影響} |
| B. 性能・拡張性 | {N} | {影響} |
| C. 運用・保守性 | {N} | {影響} |
| D. 移行性 | {N} | {影響} |
| E. セキュリティ | {N} | {影響} |
| F. システム環境・エコロジー | {N} | {影響} |

（Part 1 の `_draft/01-system.md` から転記。カテゴリ id と名前は `docs/nfr/latest/nfr-grade.yaml` の `categories[].id/name` に従う）

## ドメインアーキテクチャ推論

（Part 0 の `_draft/00-domain.md` から転記。domain 無し（no-domain モード）のときは「該当なし」と書く）

| サブドメイン | type | confidence | 根拠 |
|-------------|------|-----------|------|
| {subdomain} | Core / Supporting / Generic | {conf} | {reason} |

| BC | 所属 SD | owned entities | confidence | 根拠 |
|----|--------|----------------|-----------|------|
| {bc} | {sd} | {entities} | {conf} | {reason} |

| コンテキストマップ | upstream → downstream | パターン | 根拠 |
|-------------------|----------------------|---------|------|
| {cm} | {up} → {down} | ACL / OHS+PL / Customer-Supplier / Conformist / Shared Kernel | {reason} |

| 集約仮説 | root | invariants | confidence |
|---------|------|-----------|-----------|
| {agg} | {root} | {invariants} | low（上限） |

## システムアーキテクチャ推論

| ティア | テクノロジー候補 | confidence | 根拠 |
|--------|----------------|-----------|------|
| {tier} | {candidates} | {conf} | {reason} |

## アプリケーションアーキテクチャ推論

### {tier_name}

| レイヤー | 責務 | confidence | 根拠 |
|---------|------|-----------|------|
| {layer} | {responsibility} | {conf} | {reason} |

## データアーキテクチャ推論

| エンティティ | ストレージ | confidence | 根拠 |
|-------------|----------|-----------|------|
| {entity} | {storage} | {conf} | {reason} |

## 要確認項目

- {確認が必要な項目と理由}
```
