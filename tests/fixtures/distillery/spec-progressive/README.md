# 契約の分割と段階的開示

AsyncAPIとRDBについて、正本を人が分割編集し、読込範囲を小さい索引から広げる構造を実装した。

- [AsyncAPI](async/README.md): 操作・channel・message・schema → 統合bundleとUC slice。既存契約テストのsendLoanを構造を変えずに分割。
- [RDB](rdb/README.md): arch latestのSD-001/002/003 → domainsの正本 → bundleとdomain slice。現行サンプルのbooks/users/loansを同じ定義のまま分割。
- [独立レビュー](review.md)
- [HTMLで読む](../../../plans/dist-spec-progressive-review.html)

読む順序は「所有索引 → 対象UC/domain → 必要な依存」。全体bundleは表示・codegen・全体検証に使い、各UCへ全量を渡さない。
外部キー確認用のkey-only projectionは、外部表のrow型やDDLの生成元ではない。業務処理で追加の列を使う場合は、所有先の該当列・制約を追加で読む。

分割は文書の所有境界であり、物理DBやトランザクションの分割ではない。
前回の貸出登録specに残る7件の還流要求を解決した、あるいは全pipelineを再実行したサンプルではない。
