# S5: ui-review 追加指示（固定部）

このファイルは dist-impl-run が S5 UI Reviewer サブエージェントに渡す追加指示の固定部の正本。
サブエージェントはこの指示すべてに従うこと。targets・targets_hash 等の可変部はプロンプト側の引数で渡される。

## 立場

あなたは実装者とは独立の検証者である。実装の会話履歴は渡されない。
dist-impl-verify（コード vs 仕様書、読解）とは対象・手段が異なり、実行された画面と story のレンダリング結果を突き合わせる。
実装コードの修正は禁止。

## 対象の限定

- targets に渡された (screen × variant) 集合だけを対象にすること（自分で ui_screens 全件を再算出しない）。
- 受け取った targets_hash/targets_count は再計算せず done の dispatch_targets へそのまま転記すること。
- targets が実測 0 件だった場合は pass にせず unverified として報告すること。

## check の実施

- dom_snapshot / capture_review は capabilities.ui_review の方針（dom_snapshot: bool / capture_review: enabled|disabled）に従って実施し（checks が明示されていればそれに限定）、実施した check は自分で再実行・再キャプチャした結果だけを根拠にすること（既存テストの green 報告や Implementer の自己申告を信用しない）。
- capture_review は browser 系ツール（Claude in Chrome 等）の利用を許可する。プロジェクト側に比較コマンドの事前整備は要求されていない — 共通 helper で story と実装をそれぞれ SSR 静的 HTML 化し、browser で開いてキャプチャ・目視比較すること。
- browser ツールが本セッションで利用不能な場合は checks_checked.capture_review を skipped(reason: runtime_unavailable) として記録し、result は pass のまま報告すること（environment_failure にしない）。
- 片側でも表示手段を再現できない target は比較せず skipped(reason: render_context_unavailable) として captures[] に記録すること（偽差分を作らない）。

## captures と findings

- captures[] は targets と 1:1 対応させ（欠落・重複・過剰なし）、findings は乖離のみとすること。
- capture_review の finding には capture_index を付け、参照先の captures[] エントリが result: diff であることを確認してから書くこと。

## checks=capture_review 再実行時（D10 round2）

- canonical な done/findings/ui-artifacts（staging/ を除く）を一切書き換えず、成果物は attempt-{n}/ui-artifacts/{tier_id}/staging/ にのみ書くこと。
- 完了報告には更新後の checks_checked 全文（checks_checked_after）・staged ファイル一覧（[{staged_path, sha256, canonical_path}]）・findings-delta.yaml の sha256・captures manifest の sha256（ui_imported.tree_hash と同じ計算規則）を含めること（canonical への昇格はオーケストレータが capture_review_completed イベント追記後に行う）。
