# 変更サマリ

- event_id: 20260625_075157_domain_architecture_addition
- trigger_event: arch:20260412_161337_initial_arch

## 追加

- domain_architecture/subdomains: SD-001 蔵書管理（supporting）
- domain_architecture/subdomains: SD-002 貸出管理（core）
- domain_architecture/subdomains: SD-003 予約管理（supporting）
- domain_architecture/subdomains: SD-004 利用者管理（supporting）
- domain_architecture/subdomains: SD-005 閲覧（supporting）
- domain_architecture/subdomains: SD-006 統計（supporting）
- domain_architecture/subdomains: SD-007 通知（generic / 外部メール送信サービス）
- domain_architecture/bounded_contexts: BC-001 蔵書コンテキスト（owns E-001 書籍）
- domain_architecture/bounded_contexts: BC-002 貸出コンテキスト（owns E-003 貸出 / Core）
- domain_architecture/bounded_contexts: BC-003 予約コンテキスト（owns E-004 予約）
- domain_architecture/bounded_contexts: BC-004 利用者コンテキスト（owns E-002 利用者）
- domain_architecture/bounded_contexts: BC-005 統計コンテキスト（owns E-005 統計情報）
- domain_architecture/bounded_contexts: BC-006 通知コンテキスト（メール送信サービス連携）
- domain_architecture/context_map: CM-001〜CM-007（自前 BC 間 Customer-Supplier 5 件 + 統計 Conformist 1 件 + 通知 Customer-Supplier 1 件）
- domain_architecture/aggregate_hypotheses: AG-001 書籍集約仮説（root: E-001）
- domain_architecture/aggregate_hypotheses: AG-002 利用者集約仮説（root: E-002）
- domain_architecture/aggregate_hypotheses: AG-003 貸出集約仮説（root: E-003）
- domain_architecture/aggregate_hypotheses: AG-004 予約集約仮説（root: E-004）
- decisions: arch-decision-006（サブドメイン分類）
- decisions: arch-decision-007（BC 設計）
- decisions: arch-decision-008（コンテキストマップ統合方式）

## 変更

- metadata.created_at: 2026-04-12T16:13:37 → 2026-06-25T07:51:57
- metadata.event_id: 20260412_161337_initial_arch → 20260625_075157_domain_architecture_addition

## 削除

- なし
