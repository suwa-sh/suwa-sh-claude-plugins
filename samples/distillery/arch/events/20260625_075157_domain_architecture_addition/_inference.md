# ドメインアーキテクチャ推論根拠サマリ

- event_id: 20260625_075157_domain_architecture_addition
- created_at: 2026-06-25T07:51:57

## 入力モデル

| モデル | 要素数 | 主な特徴 |
|--------|--------|---------|
| BUC | 6 業務 / 16 UC | 蔵書管理・貸出管理・予約管理・利用者管理・閲覧・統計 |
| 外部システム | 1 | メール送信サービス（督促・予約通知） |
| 情報 | 5 | 書籍・利用者・貸出・予約・統計情報 |
| 状態 | 2 モデル / 8 状態 | 書籍貸出状態・予約状態 |
| 条件 | 4 | 貸出期限・貸出可否・延滞判定・予約優先 |

## Q1: サブドメイン分類

| Subdomain | 分類 | confidence | 推論根拠 |
|-----------|------|-----------|---------|
| SD-001 蔵書管理 | supporting | medium | 標準的 CRUD。差別化要因なし |
| SD-002 貸出管理 | core | medium | 図書館の中核業務。貸出可否/延滞判定が固有のビジネスルール |
| SD-003 予約管理 | supporting | medium | 貸出に紐づく副次業務 |
| SD-004 利用者管理 | supporting | medium | 標準的なユーザー管理 |
| SD-005 閲覧 | supporting | medium | 検索系参照業務 |
| SD-006 統計 | supporting | medium | 読取集約系。マスタ的扱い |
| SD-007 通知 | generic | high | 外部システム（メール送信サービス）連携が明示。Generic 判定の高 confidence パターン |

**注: Core 判定（SD-002 貸出管理）は medium 上限のためユーザー確認必須 → arch-decision-006 で承認済み**

## Q2: BC 設計

| BC | 包含 SD | owned entities | confidence | 推論根拠 |
|----|---------|----------------|-----------|---------|
| BC-001 蔵書 | SD-001 + SD-005 蔵書検索 | E-001 書籍 | medium | 蔵書ドメインに参照系の検索 UC を統合 |
| BC-002 貸出 | SD-002 + SD-005 貸出履歴 | E-003 貸出 | medium | Core BC。閲覧の貸出履歴も貸出 BC が担当 |
| BC-003 予約 | SD-003 | E-004 予約 | medium | 予約状態モデルが独立 |
| BC-004 利用者 | SD-004 | E-002 利用者 | medium | PII 含むため境界明確化 |
| BC-005 統計 | SD-006 | E-005 統計情報 | medium | 読取専用集約。Conformist 適用 |
| BC-006 通知 | SD-007 | （なし） | medium | 外部システム連携の独立 BC |

**注: E-006 セッション情報は cross-cutting concern（認可横断関心事）として全 BC 未割当 → coverage 分母から意図的に除外**

## Q3: コンテキストマップ

| 関係 | パターン | direction | confidence | 推論根拠 |
|------|---------|-----------|-----------|---------|
| BC-002→BC-001 | customer_supplier | downstream | medium | 貸出が蔵書情報を必要とする |
| BC-002→BC-004 | customer_supplier | downstream | medium | 貸出が利用者情報を必要とする |
| BC-003→BC-001 | customer_supplier | downstream | medium | 予約が蔵書情報を必要とする |
| BC-003→BC-004 | customer_supplier | downstream | medium | 予約が利用者情報を必要とする |
| BC-005→BC-002 | conformist | downstream | medium | 統計は貸出データの読取専用集約 |
| BC-003→BC-002 | customer_supplier | downstream | medium | 予約解放トリガーを貸出から受領 |
| BC-006→BC-002 | customer_supplier | downstream | medium | 通知が貸出延滞情報を取得 |

**注: 外部システム（メール送信サービス）との関係は context_map に含めず、tier-external + SP-010 アダプタで ACL 隔離（arch-decision-008）**

## Q4: 集約境界仮説

| Aggregate | BC | root | members | confidence | 推論根拠 |
|-----------|-----|------|---------|-----------|---------|
| AG-001 書籍集約 | BC-001 | E-001 書籍 | (なし) | low | 単一エンティティ集約の仮説 |
| AG-002 利用者集約 | BC-004 | E-002 利用者 | (なし) | low | PII 単一集約の仮説 |
| AG-003 貸出集約 | BC-002 | E-003 貸出 | (なし) | low | 状態遷移を持つ event_snapshot の root 候補 |
| AG-004 予約集約 | BC-003 | E-004 予約 | (なし) | low | 状態遷移を持つ event_snapshot の root 候補 |

**注: 集約境界は全件 low confidence。最終確定は dist-spec または ddd-tactical-implementation で行う**

## ユーザー確認による変更

| 対象 | 項目 | 推論値 | 確定値 | 変更理由 |
|------|------|--------|--------|---------|
| Phase 0.1 サブドメイン分類 | Option A 推奨案 | 7 SD 構成 | 承認 | フル実行（推奨即時採用）モード |
| Phase 0.2 BC 設計 | Option A 推奨案 | 6 BC 構成 | 承認 | フル実行モード |
| Phase 0.3 Context Map | Option A 推奨案 | 7 関係 | 承認 | フル実行モード |
| Phase 0.4 Aggregate 仮説 | Option A 推奨案 | 4 仮説 | 承認 | フル実行モード |

## confidence 内訳（domain_architecture セクションのみ）

| 種別 | high | medium | low | default | 合計 |
|------|:----:|:------:|:---:|:-------:|:----:|
| Subdomain | 1 | 6 | 0 | 0 | 7 |
| Bounded Context | 0 | 6 | 0 | 0 | 6 |
| Context Map | 0 | 7 | 0 | 0 | 7 |
| Aggregate | 0 | 0 | 4 | 0 | 4 |
| 合計 | 1 | 19 | 4 | 0 | 24 |
