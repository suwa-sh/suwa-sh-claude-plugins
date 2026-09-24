# Changelog

version の正本は `.claude-plugin/plugin.json`。

## [0.1.2] - 2026-09-24

### Changed

- `docs/rules/*.md` の生成構造を改善。ADR 由来のルールを平坦な箇条書きで並べるのをやめ、
  依存の向き (arch_test) は「アーキテストが強制する表」に、それ以外は「ADR 番号 + 題名の見出し」の下にまとめる。
  目次 (index.md) に各ファイルの読み方 (節ごとの読み方) を追記

## [0.1.1] - 2026-09-24

初回サンプル実走 (register-loan) で見つかった不具合の修正。

### Fixed

- **genSkeleton / importUi**: apps/*/package.json の scripts を実コマンド化 (`vitest run` / `tsc --noEmit -p .` / `biome lint .` / `biome format .`)。echo プレースホルダで静的ゲートが偽の pass になる問題を解消。root devDependencies に biome / @redocly/cli / json-schema-ref-parser を追加、frontend ティア時は react 系も追加。各 app に tsconfig.json / vitest.config.ts、root に biome.json を生成。importUi が packages/ui/package.json (@repo/ui) を書き npm workspace で解決可能に。
- **.gitignore**: `reports/` と `traces/` のみ除外し `attempt-*/` は追跡する (run-state.md と整合)。
- **cucumber 設定**: ESM の default export を既定プロファイルそのものにする (`{ default: {...} }` の二重包みを解消)。実装アプリ未生成でも `--dry-run` できる `dryrun` プロファイルを追加。
- **tracer**: sanitizeScenarioId に sha256 8 桁を接尾し、日本語シナリオ名が同一ファイルへ衝突する問題を解消。
- **消費側 API クライアント生成**: genApiClient.js を追加し、OpenAPI から types.ts / client.ts / server.ts を生成する (v1 の openapi-generator codegen の置き換え)。
- **genApiClient の型変換**: JSON Schema → TypeScript の境界ケースを正しく変換する。名前付き・インライン object の `allOf` を交差型 (`A & B & { ... }`) として保持し、既知プロパティと衝突する `additionalProperties` は index signature ではなく `{ ... } & Record<string, T>` にして TS2411 を回避。ハイフン等の識別子にできない path/query パラメータ名は `args["book-id"]` でアクセスし、`args.["book-id"]` の構文エラーを解消。
- **genSkeleton の app tsconfig**: `rootDir` を外し、契約テスト (`test/contract/*.test.ts`) 生成後も `tsc --noEmit -p .` が TS6059 を出さないようにする。frontend ティアがある場合は `jsdom` を root devDependencies へ追加 (frontend の vitest は `environment: 'jsdom'`)。
- **importUi の冪等化**: 既存の `packages/ui/package.json` は管理キー (`name` / `type` / `main`) だけ更新し、手編集した `exports` 等を保持する。`.imported.yaml` に `content_sha256` を持たせ、取り込み内容が同じなら `imported_at` を据え置いて再実行をバイト一致させる。
- **as-built**: 前提の処遇を tier + id で引き、別ティアの同 id が上書きする問題を解消。
- **prTrailers**: url が無い還流を `Feedback: rule:null` として出さない。
- **config**: verifier 既定を有効な model 別名 `opus` にする (`claude-opus-5` は model パラメータとして無効)。
- **d2-run ドキュメント**: サブエージェント報告の捏造禁止、clean-tree 判定の範囲、implementer/verifier のモデル解決を明記。
- **決定候補 / d2-design**: 単一 frontend を既定にし、d2-design が ADR の `ui:` ヒント (framework / SPA vs SSR) に従うようにする。

### 移行手順 (0.1.0 → 0.1.1)

0.1.0 で生成済みのプロジェクトは、リポジトリのルートで移行コマンドを 1 回実行する。

```bash
node <plugin>/skills/d2-foundation/scripts/genSkeleton.js --adr docs/adr --migrate
```

`--migrate` は次を行う。既存ファイルは書き換え対象を限定し、手編集は保持する。

- **不足ファイルの生成**: 0.1.0 に無かった各 app の `tsconfig.json` / `vitest.config.ts` と root の `biome.json` を新規作成する (既存は上書きしない)。
- **`.gitignore` の管理ブロック更新**: `# distillery2 実行状態` から始まる管理ブロックを最新化し、`.distillery/runs/*/attempt-*/` の除外を外す (attempt は成果物として追跡する)。
- **app package.json の実コマンド化**: `apps/*/package.json` の scripts が 0.1.0 の echo プレースホルダと完全一致する場合だけ、実コマンド (`vitest run` / `tsc --noEmit -p .` / `biome lint .` / `biome format .`) へ差し替える。手編集済みの script は触らない。
- **変更の報告**: 変更したファイルと内容を標準出力へ列挙する。

移行後は `npm install` で追加依存 (frontend では `jsdom`) を取得する。

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
