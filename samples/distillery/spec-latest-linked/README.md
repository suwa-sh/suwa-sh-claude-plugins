# latestを接続する貸出仕様と還流サンプル

変更後dist-specを貸出登録1UCへ適用した実際の出力。独立したdocs/プロジェクトとして読む。

- 生成イベント: [貸出登録spec](docs/specs/events/20260906_120000_spec_generation/蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/spec.md)
- [送出した7件の還流要求](docs/specs/events/20260906_120000_spec_generation/feedback-requests/20260906_120000_spec_feedback_60d99956.md)
- [実装可能性の判定](docs/specs/events/20260906_120000_spec_generation/_review/implementation-readiness.md)
- [実施記録](docs/specs/events/20260906_120000_spec_generation/execution-record.md)

上流4stageは元サンプルのlatestをそのままコピーし、部品コード/Storiesも含めて参照を解決できる。
上流不足が残るためspecs/latestは存在しない。これは失敗を隠した完成版ではなく、前段へ何が還流するかを確認するためのドラフト出力。
APIの型や共通Props、業務状態表の再掲はしない。図と分岐の接続に必要な情報だけをUCに置く。

- [pipeline dry plan実測](pipeline-preview/README.md) / [CLIの計画出力](pipeline-preview/plan.json)
- [独立レビューround2](review/independent-round-2.yaml): ローカル指摘4件解消、上流7CRは未解決
- [比較HTML](../../../plans/dist-spec-latest-review.html): 現行との差分・生成仕様・参照元・還流要求

分割契約再生成テストを含む171テストを確認（全体170成功、version制約の失敗1件はpatch version修正後に対象7件を再実行して成功）。CIで全体を再検証する。
