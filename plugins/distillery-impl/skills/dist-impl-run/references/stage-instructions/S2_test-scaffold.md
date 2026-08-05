# S2: test-scaffold 追加指示（固定部）

このファイルは dist-impl-run が S2 サブエージェントに渡す追加指示の固定部の正本。
サブエージェントはこの指示すべてに従うこと。可変部（tiers 指定の有無等）はプロンプト側の引数で渡される。

- gherkin は仕様から意訳せず転写すること（実装リポの docs/dev-rules/test-strategy.md）。
- ATDD は uc-map の atdd_scenarios に列挙された Scenario だけを対象にし（skeleton と red baseline の確認も同範囲）、生成済みの共有 feature 本文は変更しないこと。
- done 条件は red baseline（全 4 段が「未実装を理由に」fail）。fail 理由がパースエラー・設定ミスの場合は done にせず失敗を報告すること。
- dom_snapshot が true の frontend tier については、test-strategy.md の DOM 一致テスト転写規約に従い、**executable target（定義は dist-impl-run が算出した集合そのもの — S5 UI Reviewer に渡す集合と同一）ごと**に red DOM 一致テストの足場を生成すること。
- 矛盾 3 条件で除外された行・variant（算出時に issues/ 起票済み）はこの集合に含まれないため、red baseline の分母からも外すこと（テストを生成しない。除外理由をテストファイル側のコメントにも記録）。
- 実装画面を直接 import せず、明示的な not-implemented stub の画面 adapter を生成し、テストは adapter 経由で render すること（module resolution error は red baseline と認めない — fail は「未実装」を理由とする assertion failure にする）。
- **dom_snapshot が true または capture_review が enabled の frontend tier では**、構造署名 extractor・variant→実装 props の adapter・HTML shell 生成を含む共通 helper を tier 内 1 箇所だけ生成すること（S4 のテストと S5 UI Reviewer の dom_snapshot 再実行・capture_review の SSR 静的 HTML 生成が同一 helper を使う。capture_review のみ enabled で dom_snapshot テスト自体は生成しない場合でも、この helper は生成する）。
- story args → 実装 props の fixture 契約を variant ごとに定義すること。
- **tiers が指定された場合は scoped 再実行**: 指定 tier の features/ と test/ だけを再生成し、他 tier の scaffold・features/uc/ の共有 feature（spec.md が変わった場合を除く）・features/atdd/ の既存 feature 本文には触れないこと。scoped 再実行では red baseline を done 条件にせず、dist-impl-implement の mode=test-scaffold に定める再実行時 done 条件に従い、done に scaffold_scope を記録すること。
