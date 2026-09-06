# 具体案と最新正本の整合

入力はdesign完了時点から開始した。生成中に見つかった5件は[還流要求](../feedback-requests/20260906_132000_spec_feedback_renew001.md)に記録し、通常実行のauto_adoptとして所有工程の差分イベントに反映した。正式なfeedback controllerの適用・closureを示す記録ではない。

| 要求 | 具体案 | 最新正本と採用イベント | 整合 |
|---|---|---|---|
| CR-001 | 監査・認証情報を既存BC-002/SD-003、通知要求をE-008/SD-005で所有 | arch/latest/arch-design.yaml、20260906_132303_spec_storage_ownership | entity所有と同一RDB取引の保存責任が一致 |
| CR-002 | 紙の貸出中・予約待ちを予約可能とする | design/latestのBookCard.tsxとBooks.stories.tsx、20260906_132217_design_system | RDRAの予約可否条件と部品判定が一致 |
| CR-003 | 司書の導線を実在する一覧経由のID選択に接続 | design/latestのPortalShell.tsxとScreenMapping.mdx、20260906_132217_design_system | /staff/books、/staff/usersから詳細へ進む |
| CR-004 | 有効貸出・有効予約がある利用者の削除を拒否 | rdra/latest/条件.tsvの利用者削除可否判定、USDM REQ-007、20260906_141633_spec_business_conditions | 利用者削除と新規取引の共有lockを含め一致 |
| CR-005 | 検索の正規化・条件結合と同順位時の順序を確定 | rdra/latest/条件.tsvの書籍検索条件判定・人気書籍ランキング判定、USDM REQ-007、20260906_141633_spec_business_conditions | 空検索、AND/OR、同率順位をAPI/tier/BDDへ接続 |

未採用提案は0件。仕様レビューの未解決事項はimplementation-readiness.mdで別途判定する。通知受付receiptは採用済みE-008の技術投影であり、新たな業務条件は追加しない。判断根拠は[decision-002](../decisions/spec-decision-002.yaml)を参照する。
