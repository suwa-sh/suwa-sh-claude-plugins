# samples/distillery-impl — 実装ハーネスの実行結果サンプル

distillery-impl plugin の vertical slice(2026-07-29)で、`samples/distillery/pipeline/` を
specs_root として UC「貸出管理業務/貸出管理フロー/書籍を貸出する」(uc_id `19ec0182`)を
S0→S9 一気通貫で実行した**実装先リポの実物**です(git tracked ファイルのみ。node_modules は除く)。

distillery の出力(仕様書一式)はここには含めません — 入力側の正は
[samples/distillery/pipeline/](../distillery/pipeline/) を参照してください
(vertical slice で使った最小 storybook-app も `design/latest/storybook-app/` に同梱)。

## まず見るもの

- **ヒトレビュー用 HTML(S9 の成果物)**: [docs/impl/latest/19ec0182/review/index.html](docs/impl/latest/19ec0182/review/index.html)
  をブラウザで開く。前提知識ゼロで「何を作ったか → 結論 → 根拠 → 判断ポイント」が読める構成
- **as-built仕様サマリ(S8)**: [docs/impl/latest/19ec0182/feedback/as-built-summary.md](docs/impl/latest/19ec0182/feedback/as-built-summary.md)
  — 実装が実際に満たした仕様と、仕様との差分
- **公開済みfeedback request**: [docs/impl/latest/19ec0182/feedback-requests/20260729_121600_impl_feedback_19ec0182.md](docs/impl/latest/19ec0182/feedback-requests/20260729_121600_impl_feedback_19ec0182.md)
  — 仕様起因11件を1ファイルへ集約したdist-pipeline入力。stage指定やreview metadataは含まない。
  S9で表示したdraft ID/SHA/件数とreview HTML SHA/gate/open finding集約は
  review-generated event→review-approved eventへexactに結合され、publish eventはそのlineageと同じdraft bytesを参照する
- **状態ファイル**: [docs/impl/](docs/impl/) — events(追記のみ)+ latest(スナップショット)+
  stages/ の done ファイル群。attempt-1〜3 の blocker 検出 → 解消 → carry-forward の履歴が残っている

## 還流後の仕様(次サイクルの入力)

ここにある変更要求は、単一Markdownとして distillery の判定処理へ還流済みです。[samples/distillery/pipeline/](../distillery/pipeline/) には
還流前から存在する成果(usdm イベント `20260729_140044_impl_feedback_19ec0182` = REQ-007〜012 / rdra 差分 /
specs イベント `20260729_141624_spec_generation`)があり、specs イベントの `_review/` には
dist-spec Step6.5(反証レビューループ)の findings(round-1: major 2 + minor 4 → round-2 で収束、計 8 件修正)が残っています。
加えて [pipeline/feedback-runs/](../distillery/pipeline/pipeline/feedback-runs/) にdist-pipeline内部の
振り分け計画と要求別結果を収録しています。サンプルworkspace rootが`../distillery/pipeline/`で、その配下の
`pipeline/feedback-runs/`が契約上の実行記録先となるため、リポジトリから見ると`pipeline/`が2階層に見えます。
イベント履歴を遡れば「実装前の仕様 → 実装 → 単一feedback Markdown → pipeline内部判定 →
既反映との照合・未反映の明示」の一周を追跡できます。新しいfeedback runは6件を`merged`、
5件を`deferred`、今回の変更を0件と判定し、runを`blocked`で終了します。未反映を完了扱いしません。

## 実行結果の要点

- 6 段ゲート全 pass: format / lint / 単体 47 / tier BDD 2+2 / UC BDD 4 / ATDD 2(タグ完全一致選択)
- attempt-1 で別モデル Verifier が blocker 2 件を検出(「ゲート pass だが画面未描画」
  「スキーマに無い自作フィールド」)→ attempt-2 で解消 → S6 統合 fail(cross-UC 依存等の仕様の穴)
  → backend のみ attempt-3 差し戻し・frontend は carry-forward → 全ゲート green → ヒトレビュー承認

## 再現方法

```
/distillery-impl:dist-impl-run 貸出管理業務/貸出管理フロー/書籍を貸出する specs_root={samples/distillery/pipeline の複製} repo_root={空の git リポ}
```
