# Changelog

version の正本は `.claude-plugin/plugin.json`。

## [0.1.5] - 2026-09-24

### Changed

- **as-built を読者の問いの順に組み替え** (ユーザー指摘: 認知負荷が高い)。`index.md` は 概要 (要約) → 結果 → 入口 → どう動くか →
  何を守るか (要約) → 決めたこと → 課題 (抽出 + 要約) → 証跡 → 付録。メタ情報・変更ファイルの全列挙・シナリオ表は
  付録の `<details>` へ、内部 ID (`spec_absent` / `auto_confirmed` / category / issue kind) は日本語へ、sha は 7 桁へ、
  シナリオ名の `slug#` は外す。前提は処遇 (人が承認 / 自動承認 / 却下) でグループ化し、Verifier の判定を「検証」列に統合
  (5 節のヒント・8 節の表・9 節の指摘の三重化を解消)。`coverage.md` は「証跡」に統合して廃止。要約ブロックは
  名前付き (`<!-- 要約:begin 概要|整合性|課題 -->`) にし、旧形式の名前無しブロックは順序で引き継ぐ
- **シーケンス図を e2e の入れ子で描く**: tracer v2 (`seq` / `parent` / `ts_end`) と `traceTree.js` で
  画面 → API → ユースケース → リポジトリ → DB の呼び出しの木を復元し、要求受信を DB クエリより前に描く
  (旧: 応答完了時に記録していたため順序が逆だった)。参加者は読める名前 (アクターは use-cases.yaml の actors、
  部品は component 名)、ティアが複数あれば `box` で囲む、連続する SELECT は 1 本にまとめる。index.md には正常系 1 本と
  分岐表だけを載せ、全シナリオは sequence.md
- **計装を部品ごとのティア・レイヤに**: `traced(name, obj, {tier, layer})` / `tracedFn` / `tracePg` / `tracePublisher` /
  `tracedFetch` が placement を受け、同一プロセスで複数ティアを動かす in-process 実行に対応。`expressScenarioMiddleware` は
  `x-scenario-span` ヘッダで HTTP 越しの親子を運ぶ。api ドライバに `asFetch(placement)` を追加し、step が frontend の
  画面ロジックを経由して backend を叩けるようにした (integrate.md: 入口は UC の最前のティアから、レイヤ境界は全部 `traced()` で包む)
- **計装の範囲を検出**: UC の `tiers` のうちトレースに現れないティアを「計装なし」として結果の表・標準出力・
  traceability-index の `instrumentation_gaps` に出す。d2-run の asbuilt 行はこれを integrate の結線漏れとして扱う

### Added

- **データフロー図** `renderDataFlow.js`: UC の全シナリオを合算した flowchart (アクター → ティアごとの部品 → テーブル / メッセージ。
  読み = 点線、書き = 太線) を index.md の「どう動くか」に、UC × テーブルの読み書き表と UC → テーブルの図を
  `_system/data-flow.md` に出す (traceability-index に `tables_rw`)
- tracer の実行テスト (`tracerSpans.test.js`: transpile して span の親子・開始順・ヘッダ伝播・エラー記録を実測)

## [0.1.4] - 2026-09-24

### Changed

- 実行記録 (headless 実行のプロンプト・起動スクリプト・完了報告ログ) の置き場を `.distillery/logs/` と定め、
  生成する `.gitignore` の管理ブロックで git 管理外にする。リポ直下に独自ディレクトリを作らない (run-state.md)

## [0.1.3] - 2026-09-24

### Added

- **C4 図 (決めたもの)**: `genArchitectureDoc.js` を追加。accepted な ADR (ティア構成 ADR の `tiers[]` /
  `datastore_owner` / 任意の `contexts[]`)・`contracts/contracts.json`・RDRA (`アクター.tsv` / `外部システム.tsv`)
  から `docs/adr/architecture.md` を決定論的に生成する。システムコンテキスト図 (Mermaid `C4Context`)・コンテナ図
  (`C4Container`、契約を consumer→provider のラベル付き辺 (C4 の uses は利用側→提供側) にし datastore_owner を明示)・コンテキストマップ
  (flowchart。`contexts[]` があるときだけ) を描く。d2-decide 手順 3 で `genAdrIndex` の前に走らせ、`index.md` から
  `architecture.md` へリンクする。決定領域に「コンテキストの境界」(任意の 9 番目) を追加。
- **C4 図 (実態)**: as-built 段階で `depcruise --output-type json` を撮り、`extractAsBuilt.js` の `dependency-graph.md`
  を「実態 (dependency-cruiser)」として描く。JSON が無いときは `.distillery/config.yaml` のティア・契約から
  「決定からの図」(契約の consumer→provider) を描き、実態か決定かを本文に明記する (ファイルを空にしない)。
- **ブランド方針**: ADR の `ui.brand` (`name` / `colors` / `typography` / `tone` / `source` / `confidence`) を追加。
  d2-decide は `brand` スキルがあれば走らせて (`source: brand skill`)、無ければ RDRA から推論 (`source: inferred`・
  `confidence: low`) して埋める。d2-design のトークンは `ui.brand` を起点にする (再推論しない)。`_review-summary.md`
  にブランドの由来を載せる。
- **アセット生成の復活**: `references/design/design-assets.md` を追加 (ロゴ SVG / ファビコン / アイコンセットの方針)。
  d2-design 手順 3.5 で `docs/design/storybook-app/src/assets/` に書き、F6 の `importUi.js` が `packages/ui/assets/`
  に取り込む (`src/` を丸ごとコピーするため設定変更不要)。
- **目視の証跡**: `captureStories.js` を追加。Storybook を静的ビルドし、`playwright` が対象リポで解決できれば
  headless chromium で各 Story を撮って `docs/design/screenshots/<StoryId>.png` と `index.md` を書く (exit 0)。
  playwright 無し / ビルド失敗 / Story 0 件 / chromium 起動・撮影失敗は exit 2 (目視未実施) を明示する。
  再撮影時は現行 Story ID に無い古い PNG を除いて証跡を実行履歴に依存させない。d2-design 手順 4 の目視確認で使う。

### Changed

- ADR スキーマ (`schema-adr.json`) に `contexts[]` と `ui.brand` / `ui.rendering` 等の型を追加。
- d2-run / d2-asbuilt の as-built 手順に depcruise JSON の生成を追記。

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
