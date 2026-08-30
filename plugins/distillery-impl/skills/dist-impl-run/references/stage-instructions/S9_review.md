# S9: review 追加指示（固定部）

このファイルはdist-impl-runがreview writerへ渡す固定指示の正本。

- HTMLの最初のviewportを「ユーザーにお願いしたいこと」にする。
- 実装承認と、仕様・運用上の未確定事項の選択を分ける。
- 各未確定事項へ相互排他的な2〜3案を示し、最初に推奨案、理由、結果、trade-off、
  推奨が変わる条件、選択後のactionを示す。
- copy可能な回答template（例: `機能=A / 相互運用=A / 監査=A / 前提=A-001:承認 / A-002:却下(実装修正: …)`）を表示する。
- 「実装者が補った前提」節を置く。全tierの `S4_tier-impl.{tier}.assumptions.yaml` とS5 findingsの
  `assumption_verdicts` を読み、前提ごとにカテゴリ・前提・理由・Verifierの判定・影響箇所・回答要否を示す。
  回答必須（仕様に無い、かつ Implementer分類かVerifier分類が security / persistence）を先頭に集め、
  `必須` と文字で示す。却下の回答には `実装修正` か `仕様変更` の種別が要ることをtemplateに書く。
- UCの目的・actor・trigger・入出力・rule・受け入れ条件、完成した実装、動かし方、
  testと未確認範囲を判断の根拠として示す。
- 図を描く前に`diagram-design`の存在を確認する。無ければ生成を停止してsource、security audit、
  `npx skills add cathrynlavery/diagram-design`を提示する。
- 存在する場合はdiagram-designのSKILL、style guide、選んだtype referenceを全文読み、
  構成図、処理flow、data flowへtaste gateを適用する。
- off-axis connectorはrounded orthogonal pathだけを使う。diagonal、overlap、shared attach point、
  non-endpoint node背面通過を禁止し、connectorをnodeより先に描く。
- 各図にcaption、legend、accessible name、文章のtext alternativeを付ける。
- 各SVGを`data-diagram-type`で分類し、`data-layer="connectors"` groupを
  `data-layer="nodes"` groupより先にする。review skill同梱validatorを実行し、非0ならdoneを書かない。
- validator通過後もrenderを目視し、重なり、attach point共有、node背面通過、label gapを確認する。
- external asset/font/script/Mermaid runtimeを使わず、inline CSS/SVGだけの1 HTMLにする。
- attempt履歴、内部stage code、raw status、tier/finding IDを読者向け本文へ出さない。
- feedback requestはhuman titleを主表示し、管理ID、事実、問題、要求、完了条件を全文表示し、
  対応する選択肢へ結ぶ。
- captureは生成時にだけ実在・path・記録SHAを確認して表示する。承認時に再検証しない。
- HTMLはgitignoreされた補助資料であり、git add/commitしない。HTMLを再生成してもstate evidenceを
  更新しない。
- done/eventへはfeedback draftのidentity/SHA/countと、gate/open finding集約、前提と判定のhash
  （`implementation_review_evidence.assumption_evidence_sha256`）だけを記録する。
  HTML SHAとcapture SHAは記録しない。
- preview、回答取得、feedback refresh、approval、publishはorchestratorが行う。
