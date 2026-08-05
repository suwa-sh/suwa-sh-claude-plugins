# S9: review 追加指示（固定部）

このファイルは dist-impl-run が S9 サブエージェントに渡す追加指示の固定部の正本。
サブエージェントはこの指示すべてに従うこと。

- 前提知識ゼロの読者が実装の合否を判断できる構成にすること（review-html-template.md）。
- 仕様起因の残課題は feedback ID/件数/path と、各 CR の事実・問題・要求・完了条件を全文（details 可）で示すこと。ただし pipeline 内部の所有 stage・振り分け・個別処理指示・承認 hash は HTML へ生成しないこと。
- capture_review の画像は captures[] の非 skipped エントリごとに path containment・regular file・存在・実測 SHA-256 と findings.yaml 記載値の一致を検証してから表示し、不一致・欠落があれば S9 を完了しないこと。
- checks_checked.capture_review.status: done の tier については、対象 UC の executable target 集合を dist-impl-run/SKILL.md の算出規則で独立に再計算し、captures[].target と 1:1 対応する（欠落・重複・過剰なし）ことも検証すること。
- capture_review の finding は capture_index が 0 <= capture_index < captures.length かつ参照先 captures[capture_index].result: diff であることを確認すること。いずれか不一致なら S9 を完了しないこと。
- 表示した draft の feedback ID / exact bytes SHA-256 / request 件数は内部の feedback_review_evidence、HTML SHA / gate 結果 / open blocker・major 件数 / captures_sha256（検証済み実測値から算出）は implementation_review_evidence として S9 done へ記録すること。
- 生成後のプレビュー表示と承認対話はオーケストレータが行う。
