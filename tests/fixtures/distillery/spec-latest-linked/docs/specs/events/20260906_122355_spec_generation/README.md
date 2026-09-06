# 貸出登録の目標仕様

7件の還流要求の具体案が採用された場合の仕様を生成した。現在の上流latestは未変更、採用状況はproposedである。

- [仕様](蔵書利用業務/書籍を貸し出すフロー/貸出を登録する/spec.md)
- [還流要求](feedback-requests/20260906_122355_spec_feedback_60d99956.md)
- [提案対応表](_review/proposal-baseline.md)

readinessはneeds-spec-changeであり、specs/latestへ昇格していない。3依存UCは既存参照コンテキストを引き継いだ。本文の業務参照は現在のlatestを指し、未採用の差分は提案対応表に記録した。

- [独立レビュー](_review/independent-review.md)
- [現行latestの照合と採用時の実演](_review/reconciliation/README.md)
- [pipelineのdry plan](_review/pipeline-preview/README.md)

検証: 契約の10生成物が再生成一致、7件の還流要求を受理、4UCの本文検査と相対リンク確認が成功。
隔離したCR-004説明修正の照合では本文14ファイルと実際のlatestを変更していない。
