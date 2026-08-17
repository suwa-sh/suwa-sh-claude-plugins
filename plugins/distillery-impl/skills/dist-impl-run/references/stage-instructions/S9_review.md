# S9: review 追加指示（固定部）

このファイルは dist-impl-run が S9 サブエージェントに渡す追加指示の固定部の正本。
サブエージェントはこの指示すべてに従うこと。

- 前提知識ゼロの読者が、UCと対象仕様を理解して実装の合否を判断できる構成にする
  （review-html-template.md）。
- HTMLの主軸を、UCの目的・actor・trigger・入力・出力・業務ルール・受け入れ条件、完成した実装の
  構成・処理・data、動かし方、テストと確認方法に置く。
- 構成図、処理フロー図、データフロー図をinline SVGまたはHTML/CSSで生成する。各図にcaption、凡例、
  短いテキスト代替を付け、外部runtimeやMermaid rendererへ依存しない。
- attemptごとのレビュー指摘、blocker/major件数の推移、修正履歴はHTMLへ生成しない。現在openの問題だけを示す。
- `S1`〜`S9`、`attempt-*`、raw status、tier ID、finding IDを読者向けの見出し・説明に使わない。
  「仕様入力の確認」「起動受付CLI」「UC統合テスト」等の意味が分かる名称へ変換する。
- 仕様起因の残課題はfeedback ID/件数/pathと、各CRの事実・問題・要求・完了条件を全文（details可）で
  示す。ただしpipeline内部の所有stage・振り分け・個別処理指示・承認hashはHTMLへ生成しない。
- capture_review画像はcaptures[]の非skipped entryごとにpath containment・regular file・存在・
  実測SHA-256とfindings記載値の一致を検証してから、「テストと確認方法」に表示する。
  不一致・欠落があればS9を完了しない。
- `checks_checked.capture_review.status: done`のtierでは、対象UCのexecutable target集合を
  dist-impl-run/SKILL.mdの算出規則で独立再計算し、captures[].targetと1:1対応することを検証する。
- capture_review findingは`0 <= capture_index < captures.length`かつ参照先`result: diff`を確認する。
  いずれか不一致ならS9を完了しない。
- 表示したdraftのfeedback ID / exact bytes SHA-256 / request件数は内部の
  `feedback_review_evidence`、HTML SHA / 確認結果 / open blocker・major件数 / captures_sha256は
  `implementation_review_evidence`としてS9 doneへ記録する。
- 生成後のプレビュー表示と承認対話はオーケストレータが行う。
