# distillery-impl実行サンプル

このdirectoryは、UC「書籍を貸出する」をS0からS9まで実行した結果です。
現行の公開仕様は[samples/distillery/pipeline/](../distillery/pipeline/)にあります。
この実装サンプルは従来仕様での実行結果です。新構成に対する確認範囲と結果は[入力互換性確認](docs/spec-input-compatibility.md)を参照してください。

## 確認するファイル

| 確認内容 | ファイル |
|---|---|
| 実装レビュー | [review/index.html](docs/impl/latest/19ec0182/review/index.html) |
| 実装済み仕様と差分 | [feedback/as-built-summary.md](docs/impl/latest/19ec0182/feedback/as-built-summary.md) |
| pipelineへ渡した11件の要求 | [feedback request](docs/impl/latest/19ec0182/feedback-requests/20260729_121600_impl_feedback_19ec0182.md) |
| stageとeventの状態 | [docs/impl/](docs/impl/) |

公開済みfeedback requestは、stage指定とレビュー情報を含まない単一Markdownです。
S9 eventとapproval eventは、レビュー画面に表示したdraftのID、SHA-256、要求数を保持します。
publish eventは、同じdraft bytesを公開したことを記録します。

## 実行結果

実装は3回のattemptで完了しました。

1. attempt 1でVerifierがblockerを2件検出した。
2. attempt 2でblockerを解消したが、統合時に仕様の不足を検出した。
3. attempt 3でbackendを修正し、全gateを通過した。

最終的に、format、lint、単体テスト、tier BDD、UC BDD、ATDDがPASSしました。
S9の承認後、仕様起因の11件を1つのMarkdownとして公開しました。

## distilleryへの還流結果

pipeline側の実行記録は[feedback-runs/](../distillery/pipeline/pipeline/feedback-runs/)にあります。

| 判定 | 件数 | 意味 |
|---|---:|---|
| `merged` | 6 | 既存の仕様eventで充足を確認した |
| `deferred` | 5 | 未反映または判断が必要だった |
| `applied` | 0 | 今回はdomain成果物を変更しなかった |

未反映が5件あるため、run全体は`blocked`です。
詳細は[pipeline sample README](../distillery/pipeline/README.md#pipeline-feedback-run)を参照してください。

## 再現方法

```text
/distillery-impl:dist-impl-run 貸出管理業務/貸出管理フロー/書籍を貸出する specs_root={samples/distillery/pipeline の複製} repo_root={空のgit repository}
```
