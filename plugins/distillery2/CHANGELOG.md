# Changelog

version の正本は `.claude-plugin/plugin.json`。

## [0.1.0] - 2026-09-23

初版。distillery + distillery-impl の再設計。UC 1 つの縦切りが通る範囲を対象にする。

### Added

- 共有ライブラリ `scripts/lib/` (yaml / canonicalJson / schemaValidate / basis / gherkin / resolveDep / runState)
- `scripts/runGates.js` (5 ゲートを安い順に実行)、`scripts/prTrailers.js`、`scripts/tokenReport.js`
- `d2-run`: オーケストレータ (段階の振り分け、派遣テンプレート、実行状態、git 配送、還流の分類)
- `d2-requirements`: v1 dist-requirements を移植。events/latest を廃止し `docs/requirements/` に直接書く。`use-cases.yaml` を新設
- `d2-decide`: v1 dist-quality-attributes を移植。ADR (機械可読 `rules[]`、`tiers[]`) と決定候補カタログを新設。設計 yaml は書かない
- `d2-foundation`: rules 生成、依存方向のアーキテスト、テスト基盤 (計装 tracer、pglite、Cucumber support)、config、CI、骨格、Storybook 取り込み
- `d2-design`: v1 dist-design-system を移植。`screens.yaml` に集約
- `d2-contract`: v1 dist-spec の契約部分を移植。`uc-index.yaml`、契約テストと DB migration の生成、examples 必須
- `d2-implement`: scenario / scaffold / tier / integrate の 4 mode。AssumptionRecord と検証器を v1 から移植
- `d2-verify`: 2 観点 (UC の意図、前提の整合) に縮小。テストを再実行しない
- `d2-asbuilt`: 実装からの文書抽出 (抽出 / 要約の分離、追跡表、シーケンス図)
- `agents/d2-verifier.md`

### 未対応 (今後の版で)

harvest、リリース後の 3 入口、ドリフト検知、`@browser` の既定 on、プロセスをまたぐトレース、KVS 契約
